from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.client import Client
from app.models.user import User
from app.schemas.base import PaginatedResponse
from app.schemas.property import PropertyCreate, PropertyResponse, PropertyUpdate
from app.services import property as property_service
from app.services import gateway_heartbeat as heartbeat_service
from app.schemas.gateway_status import GatewayStatusResponse

router = APIRouter()


def _resolve_client_id(
    user: User, db: Session, client_id: int | None = None
) -> int | None:
    """For clients, enforce filtering to their own properties."""
    if user.rol == "admin":
        return client_id
    client = db.execute(
        select(Client).where(
            Client.usuario_id == user.id, Client.eliminado_en.is_(None)
        )
    ).scalar_one_or_none()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Client record not found",
        )
    return client.id


def _check_ownership(user: User, db: Session, property_id: int) -> None:
    """Ensure a client user owns the property."""
    if user.rol == "admin":
        return
    prop = property_service.get_property(db, property_id)
    client = db.execute(
        select(Client).where(
            Client.usuario_id == user.id, Client.eliminado_en.is_(None)
        )
    ).scalar_one_or_none()
    if client is None or prop.cliente_id != client.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this property",
        )


@router.get("", response_model=PaginatedResponse[PropertyResponse])
def list_properties(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    client_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resolved_client_id = _resolve_client_id(current_user, db, client_id)
    items, total = property_service.list_properties(
        db, page, per_page, resolved_client_id
    )
    return PaginatedResponse(
        page=page,
        per_page=per_page,
        total=total,
        data=[PropertyResponse.model_validate(p) for p in items],
    )


@router.post("", response_model=PropertyResponse, status_code=201)
def create_property(
    data: PropertyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    prop = property_service.create_property(db, data)
    return PropertyResponse.model_validate(prop)


@router.get("/{property_id}", response_model=PropertyResponse)
def get_property(
    property_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_ownership(current_user, db, property_id)
    prop = property_service.get_property(db, property_id)
    return PropertyResponse.model_validate(prop)


@router.get(
    "/{property_id}/gateway/status",
    response_model=GatewayStatusResponse,
    response_model_exclude_none=True,
)
def get_property_gateway_status(
    property_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_ownership(current_user, db, property_id)
    gateway = heartbeat_service.get_property_gateway(db, property_id)
    include_identity = current_user.rol == "admin"
    return heartbeat_service.build_status_payload(
        db, gateway, include_pending_identity=include_identity
    )


@router.put("/{property_id}", response_model=PropertyResponse)
def update_property(
    property_id: int,
    data: PropertyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    prop = property_service.update_property(db, property_id, data)
    return PropertyResponse.model_validate(prop)


@router.delete("/{property_id}", response_model=PropertyResponse)
def delete_property(
    property_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    prop = property_service.soft_delete_property(db, property_id)
    return PropertyResponse.model_validate(prop)
