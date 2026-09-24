"""Copy an active global template version into an existing property's gateway slots."""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Gateway,
    GatewayConfig,
    GatewaySlot,
    GatewayTemplate,
    GatewayTemplateVersion,
    HardwareProfile,
    IrrigationArea,
    Node,
    PhysicalBinding,
    Property,
)


def copy_to_property(db: Session, template_id: int, version_id: int, property_id: int) -> dict:
    template = db.execute(
        select(GatewayTemplate)
        .where(GatewayTemplate.id == template_id)
        .with_for_update()
    ).scalar_one_or_none()
    version = db.execute(
        select(GatewayTemplateVersion)
        .where(
            GatewayTemplateVersion.id == version_id,
            GatewayTemplateVersion.plantilla_id == template_id,
        )
        .with_for_update()
    ).scalar_one_or_none()
    if template is None or version is None:
        raise HTTPException(status_code=404, detail="Gateway template version not found")
    if template.estado != "active" or version.estado != "active":
        raise HTTPException(status_code=409, detail="Only active template versions can be copied")

    prop = db.execute(
        select(Property).where(
            Property.id == property_id,
            Property.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")
    gateway = db.execute(
        select(Gateway)
        .where(Gateway.predio_id == property_id, Gateway.eliminado_en.is_(None))
        .with_for_update()
    ).scalar_one_or_none()
    if gateway is None:
        raise HTTPException(status_code=409, detail="Provision a gateway before copying a template")

    definition = version.definicion
    requested_slots = definition.get("slots") if isinstance(definition, dict) else None
    if not isinstance(requested_slots, list) or not requested_slots:
        raise HTTPException(status_code=422, detail="Template version has no valid slot definitions")
    area_names: list[str] = []
    profile_codes: set[str] = set()
    for slot in requested_slots:
        name = slot.get("area_name") if isinstance(slot, dict) else None
        code = slot.get("hardware_profile_code") if isinstance(slot, dict) else None
        if not isinstance(name, str) or not name.strip() or (code is not None and not isinstance(code, str)):
            raise HTTPException(status_code=422, detail="Template version has an invalid slot definition")
        area_names.append(name.strip())
        if code is not None:
            profile_codes.add(code.strip().lower())
    normalized_names = [name.casefold() for name in area_names]
    if len(set(normalized_names)) != len(normalized_names):
        raise HTTPException(status_code=422, detail="Template version contains duplicate area selectors")

    rows = db.execute(
        select(IrrigationArea, Node)
        .join(Node, Node.area_riego_id == IrrigationArea.id)
        .where(
            IrrigationArea.predio_id == property_id,
            IrrigationArea.eliminado_en.is_(None),
            Node.eliminado_en.is_(None),
            Node.activo.is_(True),
        )
    ).all()
    areas_by_name: dict[str, list[tuple[IrrigationArea, Node]]] = {}
    for area, node in rows:
        areas_by_name.setdefault(area.nombre.strip().casefold(), []).append((area, node))
    resolved: list[tuple[IrrigationArea, Node, str | None]] = []
    for slot, normalized in zip(requested_slots, normalized_names, strict=True):
        matches = areas_by_name.get(normalized, [])
        if len(matches) != 1:
            raise HTTPException(
                status_code=422,
                detail="Every template selector must match one existing area and active node in this property",
            )
        profile_code = slot.get("hardware_profile_code")
        area, node = matches[0]
        resolved.append((area, node, profile_code.strip().lower() if profile_code else None))

    profiles = {}
    if profile_codes:
        profiles = {
            code: profile_id
            for code, profile_id in db.execute(
                select(HardwareProfile.codigo, HardwareProfile.id).where(
                    HardwareProfile.codigo.in_(profile_codes),
                    HardwareProfile.activo.is_(True),
                )
            )
        }
        if profiles.keys() != profile_codes:
            raise HTTPException(status_code=422, detail="Template uses an unknown or inactive profile")
    resolved = [
        (area, node, profiles.get(profile_code) if profile_code is not None else None)
        for area, node, profile_code in resolved
    ]

    if db.scalar(select(GatewayConfig.id).where(GatewayConfig.pasarela_id == gateway.id).limit(1)):
        raise HTTPException(status_code=409, detail="Published gateway configurations cannot be overwritten")
    current_slots = list(
        db.scalars(
            select(GatewaySlot)
            .where(GatewaySlot.pasarela_id == gateway.id)
            .with_for_update()
        )
    )
    if current_slots:
        bound_slot = db.scalar(
            select(PhysicalBinding.id)
            .where(PhysicalBinding.ranura_id.in_([slot.id for slot in current_slots]))
            .limit(1)
        )
        if bound_slot is not None:
            raise HTTPException(status_code=409, detail="Working sets with binding history cannot be replaced")

    resolved_by_area = {area.id: (area, node, profile_id) for area, node, profile_id in resolved}
    existing_by_area = {slot.area_riego_id: slot for slot in current_slots}
    for area_id, slot in existing_by_area.items():
        if area_id not in resolved_by_area:
            db.delete(slot)
    for area, node, profile_id in resolved:
        slot = existing_by_area.get(area.id)
        if slot is None:
            slot = GatewaySlot(
                pasarela_id=gateway.id,
                area_riego_id=area.id,
                nodo_id=node.id,
            )
            db.add(slot)
        elif slot.nodo_id != node.id:
            raise HTTPException(status_code=409, detail="Prepared slot no longer matches its logical node")
        slot.perfil_hardware_id = profile_id
        slot.version_plantilla_id = version.id
    db.flush()
    copied_slots = list(
        db.scalars(
            select(GatewaySlot)
            .where(GatewaySlot.pasarela_id == gateway.id)
            .order_by(GatewaySlot.area_riego_id)
        )
    )
    db.commit()
    return {
        "property_id": property_id,
        "gateway_id": gateway.id,
        "template_id": template.id,
        "template_version_id": version.id,
        "working_set": [
            {
                "slot_id": slot.id,
                "irrigation_area_id": slot.area_riego_id,
                "logical_node_id": slot.nodo_id,
                "hardware_profile_id": slot.perfil_hardware_id,
                "template_version_id": slot.version_plantilla_id,
            }
            for slot in copied_slots
        ],
    }
