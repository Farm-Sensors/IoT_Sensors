from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.property import Property
from app.schemas.property import PropertyCreate, PropertyUpdate


def get_property(db: Session, property_id: int) -> Property:
    prop = db.execute(
        select(Property).where(
            Property.id == property_id, Property.eliminado_en.is_(None)
        )
    ).scalar_one_or_none()
    if prop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Property with id {property_id} not found",
        )
    return prop


def list_properties(
    db: Session,
    page: int,
    per_page: int,
    client_id: int | None = None,
) -> tuple[list[Property], int]:
    query = select(Property).where(Property.eliminado_en.is_(None))
    count_query = (
        select(func.count())
        .select_from(Property)
        .where(Property.eliminado_en.is_(None))
    )
    if client_id is not None:
        query = query.where(Property.cliente_id == client_id)
        count_query = count_query.where(Property.cliente_id == client_id)

    total = db.execute(count_query).scalar() or 0
    items = list(
        db.execute(
            query.order_by(Property.id).offset((page - 1) * per_page).limit(per_page)
        ).scalars()
    )
    return items, total


def create_property(db: Session, data: PropertyCreate) -> Property:
    # Validate client exists
    client = db.execute(
        select(Client).where(Client.id == data.client_id, Client.eliminado_en.is_(None))
    ).scalar_one_or_none()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client with id {data.client_id} not found",
        )

    prop = Property(
        cliente_id=data.client_id,
        nombre=data.name,
        ubicacion=data.location,
    )
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return prop


def update_property(db: Session, property_id: int, data: PropertyUpdate) -> Property:
    prop = get_property(db, property_id)
    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data:
        prop.nombre = update_data["name"]
    if "location" in update_data:
        prop.ubicacion = update_data["location"]

    db.commit()
    db.refresh(prop)
    return prop


def soft_delete_property(db: Session, property_id: int) -> Property:
    prop = get_property(db, property_id)
    prop.eliminado_en = func.now()
    db.commit()
    db.refresh(prop)
    return prop


def set_reference_location(
    db: Session, property_id: int, latitude: float, longitude: float
) -> None:
    """Store the device-reported reference location of a property.

    Called by the v2 ``location`` operation: the gateway reports the position the
    technician configured on the device, so the property is georeferenced without
    waiting for an IoT node with GPS.
    """
    prop = get_property(db, property_id)
    quantum = Decimal("0.0000001")
    prop.latitud = Decimal(str(latitude)).quantize(quantum)
    prop.longitud = Decimal(str(longitude)).quantize(quantum)
    db.commit()
