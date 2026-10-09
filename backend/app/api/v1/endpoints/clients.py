from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_client, require_admin
from app.db.session import get_db
from app.models.client import Client
from app.models.user import User
from app.schemas.base import PaginatedResponse
from app.schemas.client import (
    ClientCreate,
    ClientNotificationSettingsResponse,
    ClientNotificationSettingsUpdate,
    ClientResponse,
    ClientUpdate,
)
from app.schemas.dashboard_preferences import (
    DashboardPreferencesResponse,
    DashboardPreferencesUpdate,
)
from app.services import client as client_service
from app.services import dashboard_preferences as preferences_service

router = APIRouter()


@router.get(
    "/me/notification-settings", response_model=ClientNotificationSettingsResponse
)
def get_my_notification_settings(
    current_client: Client = Depends(get_current_client),
):
    return ClientNotificationSettingsResponse(
        notifications_enabled=current_client.notificaciones_habilitadas
    )


@router.patch(
    "/me/notification-settings",
    response_model=ClientNotificationSettingsResponse,
)
def update_my_notification_settings(
    payload: ClientNotificationSettingsUpdate,
    current_client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    updated = client_service.update_client_notification_settings(
        db,
        client_id=current_client.id,
        notifications_enabled=payload.notifications_enabled,
    )
    return ClientNotificationSettingsResponse(
        notifications_enabled=updated.notificaciones_habilitadas
    )


@router.get(
    "/me/dashboard-preferences", response_model=DashboardPreferencesResponse
)
def get_my_dashboard_preferences(
    current_client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    row = preferences_service.get_preferences(db, current_client.id)
    return DashboardPreferencesResponse(
        client_id=current_client.id,
        cards=list(row.tarjetas) if row is not None else None,
    )


@router.get("", response_model=PaginatedResponse[ClientResponse])
def list_clients(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    clients, total = client_service.list_clients(db, page, per_page)
    return PaginatedResponse(
        page=page,
        per_page=per_page,
        total=total,
        data=[ClientResponse.model_validate(c) for c in clients],
    )


@router.post("", response_model=ClientResponse, status_code=201)
def create_client(
    data: ClientCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    client = client_service.create_client(db, data)
    return ClientResponse.model_validate(client)


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(
    client_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    client = client_service.get_client(db, client_id)
    return ClientResponse.model_validate(client)


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: int,
    data: ClientUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    client = client_service.update_client(db, client_id, data)
    return ClientResponse.model_validate(client)


@router.delete("/{client_id}", response_model=ClientResponse)
def delete_client(
    client_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    client = client_service.soft_delete_client(db, client_id)
    return ClientResponse.model_validate(client)


@router.get(
    "/{client_id}/dashboard-preferences", response_model=DashboardPreferencesResponse
)
def get_dashboard_preferences(
    client_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    client_service.get_client(db, client_id)
    row = preferences_service.get_preferences(db, client_id)
    return DashboardPreferencesResponse(
        client_id=client_id,
        cards=list(row.tarjetas) if row is not None else None,
    )


@router.put(
    "/{client_id}/dashboard-preferences", response_model=DashboardPreferencesResponse
)
def update_dashboard_preferences(
    client_id: int,
    payload: DashboardPreferencesUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    client_service.get_client(db, client_id)
    row = preferences_service.upsert_preferences(db, client_id, payload.cards)
    return DashboardPreferencesResponse(
        client_id=client_id,
        cards=list(row.tarjetas) if row is not None else None,
    )
