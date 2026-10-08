"""Gateway provisioning and one-time credential lifecycle for the cloud control plane."""

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Gateway,
    GatewaySlot,
    HardwareProfile,
    IrrigationArea,
    Node,
    PhysicalBinding,
    Property,
)
from app.schemas.gateway import GatewayProvision

def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Gateway not found")


def get_gateway(db: Session, gateway_id: int) -> Gateway:
    gateway = db.execute(
        select(Gateway)
        .options(selectinload(Gateway.slots))
        .where(Gateway.id == gateway_id, Gateway.eliminado_en.is_(None))
    ).scalar_one_or_none()
    if gateway is None:
        raise _not_found()
    return gateway


def list_gateways(db: Session) -> list[Gateway]:
    return list(
        db.scalars(
            select(Gateway)
            .options(selectinload(Gateway.slots))
            .where(Gateway.eliminado_en.is_(None))
            .order_by(Gateway.id)
        ).unique()
    )


def provision_gateway(db: Session, data: GatewayProvision) -> Gateway:
    prop = db.execute(
        select(Property).where(Property.id == data.property_id, Property.eliminado_en.is_(None))
    ).scalar_one_or_none()
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")
    if len({slot.irrigation_area_id for slot in data.slots}) != len(data.slots):
        raise HTTPException(status_code=422, detail="Duplicate irrigation area")

    area_ids = [slot.irrigation_area_id for slot in data.slots]
    rows = db.execute(
        select(IrrigationArea.id, IrrigationArea.predio_id, Node.id)
        .join(Node, Node.area_riego_id == IrrigationArea.id)
        .where(
            IrrigationArea.id.in_(area_ids),
            IrrigationArea.predio_id == data.property_id,
            IrrigationArea.eliminado_en.is_(None),
            Node.eliminado_en.is_(None),
            Node.activo.is_(True),
        )
    ).all()
    node_by_area = {area_id: node_id for area_id, _, node_id in rows}
    if len(node_by_area) != len(area_ids):
        raise HTTPException(
            status_code=422,
            detail="Every slot must reference an existing area and active logical node in this property",
        )
    profile_ids = {
        slot.hardware_profile_id for slot in data.slots if slot.hardware_profile_id is not None
    }
    if profile_ids:
        approved_profiles = set(
            db.scalars(
                select(HardwareProfile.id).where(
                    HardwareProfile.id.in_(profile_ids), HardwareProfile.activo.is_(True)
                )
            )
        )
        if approved_profiles != profile_ids:
            raise HTTPException(status_code=422, detail="Unknown or inactive hardware profile")

    gateway = db.execute(
        select(Gateway)
        .where(Gateway.predio_id == data.property_id, Gateway.eliminado_en.is_(None))
        .with_for_update()
    ).scalar_one_or_none()
    if gateway is not None:
        if gateway.estado != "revoked":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A gateway already exists for this property",
            )
        return _reprovision_revoked_gateway(db, gateway, data, node_by_area)

    gateway = Gateway(predio_id=data.property_id)
    db.add(gateway)
    try:
        db.flush()
        for requested in data.slots:
            db.add(
                GatewaySlot(
                    pasarela_id=gateway.id,
                    area_riego_id=requested.irrigation_area_id,
                    nodo_id=node_by_area[requested.irrigation_area_id],
                    perfil_hardware_id=requested.hardware_profile_id,
                )
            )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A gateway or prepared slot already exists for this property",
        ) from exc
    db.refresh(gateway)
    return get_gateway(db, gateway.id)


def _slot_has_binding_history(db: Session, slot: GatewaySlot) -> bool:
    """True when binding history pins this slot identity (composite FK)."""
    return (
        db.execute(
            select(PhysicalBinding.id).where(PhysicalBinding.ranura_id == slot.id).limit(1)
        ).first()
        is not None
    )


def _reprovision_revoked_gateway(
    db: Session, gateway: Gateway, data: GatewayProvision, node_by_area: dict[int, int]
) -> Gateway:
    """Reuse a revoked gateway row so its property can be provisioned again.

    The cloud keeps exactly one gateway row per property (``pasarelas.predio_id`` is
    unique) and slot rows are referenced by binding history, so re-provisioning resets
    the revoked row to ``pending_activation`` and reconciles its slots by irrigation
    area instead of inserting a second gateway. Slots follow the area's active node; a
    leftover slot is dropped only when it carries no binding history, and the published
    configuration is invalidated (``config_version_activa`` back to 0) because its
    snapshot predates the reconciled slots - publish again before activating.
    """
    requested_areas = {slot.irrigation_area_id for slot in data.slots}
    existing_by_area = {slot.area_riego_id: slot for slot in gateway.slots}
    leftovers = [
        (area_id, slot)
        for area_id, slot in sorted(existing_by_area.items())
        if area_id not in requested_areas
    ]
    for area_id, slot in leftovers:
        if _slot_has_binding_history(db, slot):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Irrigation area {area_id} still holds binding history on this gateway; "
                    "keep it in the request or rotate the bound device first"
                ),
            )
    for requested in data.slots:
        slot = existing_by_area.get(requested.irrigation_area_id)
        if slot is None or slot.nodo_id == node_by_area[requested.irrigation_area_id]:
            continue
        # Unreachable today: nodos.area_riego_id is UNIQUE, so an area's node cannot be
        # swapped without deleting it, and the provisioning validation rejects an area
        # whose node is missing or inactive. Kept as a guard if that invariant changes.
        if _slot_has_binding_history(db, slot):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Irrigation area {requested.irrigation_area_id} now resolves to another "
                    "active node but its slot holds binding history; rotate the bound device first"
                ),
            )

    gateway.estado = "pending_activation"
    gateway.revocado_en = None
    gateway.credencial_hash = None
    gateway.credencial_prefijo = None
    gateway.config_version_activa = 0
    gateway.activado_en = None
    gateway.ultimo_heartbeat_en = None
    stale_now = datetime.now(UTC).replace(tzinfo=None)
    stale_closed = False
    for stale in db.scalars(
        select(PhysicalBinding).where(
            PhysicalBinding.pasarela_id == gateway.id,
            PhysicalBinding.estado == "pending",
        )
    ):
        stale.estado = "closed"
        stale.cerrado_en = stale_now
        stale_closed = True
    if stale_closed:
        gateway.bindings_revision += 1
    for requested in data.slots:
        slot = existing_by_area.get(requested.irrigation_area_id)
        if slot is not None:
            slot.nodo_id = node_by_area[requested.irrigation_area_id]
            slot.perfil_hardware_id = requested.hardware_profile_id
            continue
        db.add(
            GatewaySlot(
                pasarela_id=gateway.id,
                area_riego_id=requested.irrigation_area_id,
                nodo_id=node_by_area[requested.irrigation_area_id],
                perfil_hardware_id=requested.hardware_profile_id,
            )
        )
    for _, slot in leftovers:
        db.delete(slot)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A gateway or prepared slot already exists for this property",
        ) from exc
    db.refresh(gateway)
    return get_gateway(db, gateway.id)
