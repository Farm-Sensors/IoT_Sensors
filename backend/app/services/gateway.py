"""Gateway provisioning and one-time credential lifecycle for the cloud control plane."""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import Gateway, GatewaySlot, HardwareProfile, IrrigationArea, Node, Property
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
