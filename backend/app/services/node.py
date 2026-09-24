from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.crop_type import CropType
from app.models.irrigation_area import IrrigationArea
from app.models.node import Node
from app.models.property import Property
from app.models.reading import Reading
from app.schemas.node import NodeCreate, NodeUpdate


def get_node(db: Session, node_id: int) -> Node:
    node = db.execute(
        select(Node).where(Node.id == node_id, Node.eliminado_en.is_(None))
    ).scalar_one_or_none()
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node with id {node_id} not found",
        )
    return node


def list_nodes(
    db: Session,
    page: int,
    per_page: int,
    irrigation_area_id: int | None = None,
    allowed_area_ids: list[int] | None = None,
) -> tuple[list[Node], int]:
    query = select(Node).where(Node.eliminado_en.is_(None))
    count_query = (
        select(func.count()).select_from(Node).where(Node.eliminado_en.is_(None))
    )
    if allowed_area_ids is not None:
        if not allowed_area_ids:
            return [], 0
        query = query.where(Node.area_riego_id.in_(allowed_area_ids))
        count_query = count_query.where(Node.area_riego_id.in_(allowed_area_ids))

    if irrigation_area_id is not None:
        query = query.where(Node.area_riego_id == irrigation_area_id)
        count_query = count_query.where(Node.area_riego_id == irrigation_area_id)

    total = db.execute(count_query).scalar() or 0
    items = list(
        db.execute(
            query.order_by(Node.id).offset((page - 1) * per_page).limit(per_page)
        ).scalars()
    )
    return items, total


def _to_naive_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _minutes_since_last_reading(last_ts: datetime | None) -> int | None:
    ts = _to_naive_utc(last_ts)
    if ts is None:
        return None
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    delta = now_utc - ts
    return max(0, int(delta.total_seconds() // 60))


def list_nodes_geo(
    db: Session,
    page: int,
    per_page: int,
    client_id: int | None = None,
    property_id: int | None = None,
    irrigation_area_id: int | None = None,
    include_without_coordinates: bool = False,
) -> tuple[list[dict[str, object]], int]:
    latest_reading_sq = (
        select(
            Reading.nodo_id.label("node_id"),
            func.max(Reading.marca_tiempo).label("last_reading_timestamp"),
        )
        .group_by(Reading.nodo_id)
        .subquery()
    )

    query = (
        select(
            Node.id.label("id"),
            Node.area_riego_id.label("irrigation_area_id"),
            IrrigationArea.nombre.label("irrigation_area_name"),
            Property.id.label("property_id"),
            Property.nombre.label("property_name"),
            Client.id.label("client_id"),
            Client.nombre_empresa.label("client_company_name"),
            CropType.id.label("crop_type_id"),
            CropType.nombre.label("crop_type_name"),
            Node.numero_serie.label("serial_number"),
            Node.nombre.label("name"),
            Node.latitud.label("latitude"),
            Node.longitud.label("longitude"),
            Node.activo.label("is_active"),
            latest_reading_sq.c.last_reading_timestamp,
        )
        .join(IrrigationArea, IrrigationArea.id == Node.area_riego_id)
        .join(Property, Property.id == IrrigationArea.predio_id)
        .join(Client, Client.id == Property.cliente_id)
        .join(CropType, CropType.id == IrrigationArea.tipo_cultivo_id)
        .outerjoin(latest_reading_sq, latest_reading_sq.c.node_id == Node.id)
        .where(
            Node.eliminado_en.is_(None),
            IrrigationArea.eliminado_en.is_(None),
            Property.eliminado_en.is_(None),
            Client.eliminado_en.is_(None),
            CropType.eliminado_en.is_(None),
        )
    )

    if client_id is not None:
        query = query.where(Client.id == client_id)
    if property_id is not None:
        query = query.where(Property.id == property_id)
    if irrigation_area_id is not None:
        query = query.where(IrrigationArea.id == irrigation_area_id)
    if not include_without_coordinates:
        query = query.where(Node.latitud.is_not(None), Node.longitud.is_not(None))

    count = db.execute(select(func.count()).select_from(query.subquery())).scalar() or 0

    rows = db.execute(
        query.order_by(Property.id.asc(), IrrigationArea.id.asc(), Node.id.asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).all()

    items: list[dict[str, object]] = []
    for row in rows:
        minutes_since = _minutes_since_last_reading(row.last_reading_timestamp)
        if minutes_since is None:
            freshness_status = "no_data"
        elif minutes_since >= 20:
            freshness_status = "stale"
        else:
            freshness_status = "fresh"

        items.append(
            {
                "id": row.id,
                "irrigation_area_id": row.irrigation_area_id,
                "irrigation_area_name": row.irrigation_area_name,
                "property_id": row.property_id,
                "property_name": row.property_name,
                "client_id": row.client_id,
                "client_company_name": row.client_company_name,
                "crop_type_id": row.crop_type_id,
                "crop_type_name": row.crop_type_name,
                "serial_number": row.serial_number,
                "name": row.name,
                "latitude": float(row.latitude) if row.latitude is not None else None,
                "longitude": (
                    float(row.longitude) if row.longitude is not None else None
                ),
                "is_active": row.is_active,
                "last_reading_timestamp": row.last_reading_timestamp,
                "minutes_since_last_reading": minutes_since,
                "freshness_status": freshness_status,
            }
        )

    return items, count


def create_node(db: Session, data: NodeCreate) -> Node:
    # Validate irrigation area exists
    area = db.execute(
        select(IrrigationArea).where(
            IrrigationArea.id == data.irrigation_area_id,
            IrrigationArea.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if area is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Irrigation area with id {data.irrigation_area_id} not found",
        )

    # Check 1:1 constraint — area must not already have a node
    existing_node = db.execute(
        select(Node).where(
            Node.area_riego_id == data.irrigation_area_id,
            Node.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if existing_node:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Irrigation area {data.irrigation_area_id} already has a node assigned",
        )

    node = Node(
        area_riego_id=data.irrigation_area_id,
        numero_serie=data.serial_number,
        nombre=data.name,
        latitud=data.latitude,
        longitud=data.longitude,
        activo=data.is_active,
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


def update_node(db: Session, node_id: int, data: NodeUpdate) -> Node:
    node = get_node(db, node_id)
    update_data = data.model_dump(exclude_unset=True)

    if "serial_number" in update_data:
        node.numero_serie = update_data["serial_number"]
    if "name" in update_data:
        node.nombre = update_data["name"]
    if "latitude" in update_data:
        node.latitud = update_data["latitude"]
    if "longitude" in update_data:
        node.longitud = update_data["longitude"]
    if "is_active" in update_data:
        node.activo = update_data["is_active"]

    db.commit()
    db.refresh(node)
    return node


def soft_delete_node(db: Session, node_id: int) -> Node:
    node = get_node(db, node_id)
    node.eliminado_en = func.now()
    node.activo = False
    db.commit()
    db.refresh(node)
    return node
