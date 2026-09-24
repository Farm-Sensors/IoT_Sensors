from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.authz import get_client_area_ids
from app.core.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.client import Client
from app.models.irrigation_area import IrrigationArea
from app.models.property import Property
from app.models.user import User
from app.schemas.base import PaginatedResponse
from app.schemas.node import (
    NodeCreate,
    NodeGeoResponse,
    NodeResponse,
    NodeUpdate,
)
from app.services import node as node_service

router = APIRouter()


def _check_node_ownership(user: User, db: Session, node_id: int) -> None:
    if user.rol == "admin":
        return
    node = node_service.get_node(db, node_id)
    area_ids = get_client_area_ids(user, db)
    if node.area_riego_id not in area_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this node",
        )


@router.get("", response_model=PaginatedResponse[NodeResponse])
def list_nodes(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    irrigation_area_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allowed_area_ids: list[int] | None = None

    if current_user.rol != "admin" and irrigation_area_id is not None:
        area_ids = get_client_area_ids(current_user, db)
        if irrigation_area_id not in area_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this irrigation area",
            )
    elif current_user.rol != "admin":
        allowed_area_ids = get_client_area_ids(current_user, db)

    items, total = node_service.list_nodes(
        db,
        page,
        per_page,
        irrigation_area_id,
        allowed_area_ids=allowed_area_ids,
    )
    return PaginatedResponse(
        page=page,
        per_page=per_page,
        total=total,
        data=[NodeResponse.model_validate(n) for n in items],
    )


@router.get("/geo", response_model=PaginatedResponse[NodeGeoResponse])
def list_nodes_geo(
    page: int = Query(1, ge=1),
    per_page: int = Query(200, ge=1, le=200),
    client_id: int | None = Query(None),
    property_id: int | None = Query(None),
    irrigation_area_id: int | None = Query(None),
    include_without_coordinates: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resolved_client_id = client_id

    if current_user.rol != "admin":
        client = db.execute(
            select(Client).where(
                Client.usuario_id == current_user.id,
                Client.eliminado_en.is_(None),
            )
        ).scalar_one_or_none()
        if client is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Client record not found",
            )

        if client_id is not None and client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this client",
            )
        resolved_client_id = client.id

        if property_id is not None:
            own_property = db.execute(
                select(Property.id).where(
                    Property.id == property_id,
                    Property.cliente_id == client.id,
                    Property.eliminado_en.is_(None),
                )
            ).scalar_one_or_none()
            if own_property is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this property",
                )

        if irrigation_area_id is not None:
            own_area = db.execute(
                select(IrrigationArea.id)
                .join(Property, Property.id == IrrigationArea.predio_id)
                .where(
                    IrrigationArea.id == irrigation_area_id,
                    IrrigationArea.eliminado_en.is_(None),
                    Property.cliente_id == client.id,
                    Property.eliminado_en.is_(None),
                )
            ).scalar_one_or_none()
            if own_area is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this irrigation area",
                )

    items, total = node_service.list_nodes_geo(
        db=db,
        page=page,
        per_page=per_page,
        client_id=resolved_client_id,
        property_id=property_id,
        irrigation_area_id=irrigation_area_id,
        include_without_coordinates=include_without_coordinates,
    )

    return PaginatedResponse(
        page=page,
        per_page=per_page,
        total=total,
        data=[NodeGeoResponse.model_validate(item) for item in items],
    )


@router.post("", response_model=NodeResponse, status_code=201)
def create_node(
    data: NodeCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    node = node_service.create_node(db, data)
    return NodeResponse.model_validate(node)


@router.get("/{node_id}", response_model=NodeResponse)
def get_node(
    node_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_node_ownership(current_user, db, node_id)
    node = node_service.get_node(db, node_id)
    return NodeResponse.model_validate(node)


@router.put("/{node_id}", response_model=NodeResponse)
def update_node(
    node_id: int,
    data: NodeUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    node = node_service.update_node(db, node_id, data)
    return NodeResponse.model_validate(node)


@router.delete("/{node_id}", response_model=NodeResponse)
def delete_node(
    node_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    node = node_service.soft_delete_node(db, node_id)
    return NodeResponse.model_validate(node)
