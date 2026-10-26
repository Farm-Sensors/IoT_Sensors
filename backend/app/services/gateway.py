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
from app.services.gateway_config import stage_configuration

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


def _plan_area_nodes(
    db: Session, property_id: int, area_ids: list[int]
) -> tuple[dict[int, IrrigationArea], dict[int, int | None]]:
    """Validate the requested areas and map each one to its active node (``None`` = missing).

    The area must belong to the property. A disabled or deleted node is never replaced
    silently (``nodos.area_riego_id`` is unique, so the admin has to resolve it first).
    Read-only: nothing is written until every provisioning check has passed.
    """
    areas = {
        area.id: area
        for area in db.scalars(
            select(IrrigationArea).where(
                IrrigationArea.id.in_(area_ids),
                IrrigationArea.predio_id == property_id,
                IrrigationArea.eliminado_en.is_(None),
            )
        )
    }
    if len(areas) != len(area_ids):
        raise HTTPException(
            status_code=422,
            detail="Every slot must reference an existing irrigation area in this property",
        )
    nodes = {
        node.area_riego_id: node
        for node in db.scalars(select(Node).where(Node.area_riego_id.in_(area_ids)))
    }
    node_by_area: dict[int, int | None] = {}
    for area_id in area_ids:
        node = nodes.get(area_id)
        if node is not None and node.eliminado_en is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Irrigation area {area_id} has a deleted node and cannot get a new one",
            )
        if node is not None and not node.activo:
            raise HTTPException(
                status_code=422,
                detail=f"Irrigation area {area_id} has a disabled node; enable it first",
            )
        node_by_area[area_id] = node.id if node is not None else None
    return areas, node_by_area


def _create_missing_nodes(
    db: Session, areas: dict[int, IrrigationArea], planned: dict[int, int | None]
) -> dict[int, int]:
    """Create the logical node ("Nodo <área>", no serial, active) of every area that lacks one."""
    node_by_area: dict[int, int] = {}
    for area_id, node_id in planned.items():
        if node_id is None:
            name = f"Nodo {areas[area_id].nombre}"[: Node.__table__.c.nombre.type.length]
            node = Node(area_riego_id=area_id, nombre=name, activo=True)
            db.add(node)
            db.flush()
            node_id = node.id
        node_by_area[area_id] = node_id
    return node_by_area


def provision_gateway(db: Session, data: GatewayProvision, publisher_id: int) -> Gateway:
    """Provision the property's gateway and publish its configuration in one commit.

    Areas without a logical node get one automatically, so the admin only picks the
    property and its areas; the published version is immediately pollable by the device.
    """
    prop = db.execute(
        select(Property).where(Property.id == data.property_id, Property.eliminado_en.is_(None))
    ).scalar_one_or_none()
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")
    if len({slot.irrigation_area_id for slot in data.slots}) != len(data.slots):
        raise HTTPException(status_code=422, detail="Duplicate irrigation area")

    area_ids = [slot.irrigation_area_id for slot in data.slots]
    areas, planned = _plan_area_nodes(db, data.property_id, area_ids)
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
    leftovers: list[GatewaySlot] = []
    if gateway is not None:
        if gateway.estado != "revoked":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A gateway already exists for this property",
            )
        leftovers = _check_reprovision(db, gateway, data, planned)

    try:
        node_by_area = _create_missing_nodes(db, areas, planned)
        if gateway is not None:
            _reprovision_revoked_gateway(db, gateway, data, node_by_area, leftovers)
        else:
            gateway = Gateway(predio_id=data.property_id)
            db.add(gateway)
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
            db.flush()
        stage_configuration(db, gateway, publisher_id)
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


def _check_reprovision(
    db: Session, gateway: Gateway, data: GatewayProvision, planned: dict[int, int | None]
) -> list[GatewaySlot]:
    """Reject a re-provision that would break binding history; return the slots to drop."""
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
        if slot is None or slot.nodo_id == planned[requested.irrigation_area_id]:
            continue
        # Unreachable today: nodos.area_riego_id is UNIQUE, so an area's node cannot be
        # swapped without deleting it, and provisioning rejects an area whose node is
        # disabled or deleted (it only creates one where none exists). Kept as a guard.
        if _slot_has_binding_history(db, slot):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Irrigation area {requested.irrigation_area_id} now resolves to another "
                    "active node but its slot holds binding history; rotate the bound device first"
                ),
            )
    return [slot for _, slot in leftovers]


def _reprovision_revoked_gateway(
    db: Session,
    gateway: Gateway,
    data: GatewayProvision,
    node_by_area: dict[int, int],
    leftovers: list[GatewaySlot],
) -> None:
    """Reuse a revoked gateway row so its property can be provisioned again.

    The cloud keeps exactly one gateway row per property (``pasarelas.predio_id`` is
    unique) and slot rows are referenced by binding history, so re-provisioning resets
    the revoked row to ``pending_activation`` and reconciles its slots by irrigation
    area instead of inserting a second gateway. Slots follow the area's active node and a
    leftover slot (already checked by :func:`_check_reprovision`) is dropped. The caller
    then publishes a new configuration version from the reconciled slots in the same
    commit, because the previous snapshot predates them.
    """
    existing_by_area = {slot.area_riego_id: slot for slot in gateway.slots}
    gateway.estado = "pending_activation"
    gateway.revocado_en = None
    gateway.credencial_hash = None
    gateway.credencial_prefijo = None
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
    for slot in leftovers:
        db.delete(slot)
    db.flush()
