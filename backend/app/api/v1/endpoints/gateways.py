from datetime import UTC

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.deps import require_admin, validate_gateway_credential
from app.db.session import get_db
from app.models.user import User
from app.schemas.gateway import (
    GatewayDetailResponse,
    GatewayProvision,
    GatewayResponse,
)
from app.schemas.gateway_config import (
    BindingCandidateCreate,
    BindingCandidateResponse,
    BindingConfirmation,
    BindingConfirmationResponse,
    GatewayConfigurationResponse,
    PublishConfigurationResponse,
)
from app.services import gateway as gateway_service
from app.services import binding as binding_service
from app.services import gateway_config as configuration_service
from app.services import gateway_heartbeat as heartbeat_service
from app.services import gateway_update as update_service
from app.models.gateway import Gateway
from app.schemas.gateway_status import GatewayStatusResponse
from app.schemas.gateway_update import (
    UpdateAuthorizationCreate,
    UpdateAuthorizationResponse,
    UpdateConfirmationCreate,
    UpdateConfirmationResponse,
)

router = APIRouter()


@router.get("", response_model=list[GatewayDetailResponse])
def list_gateways(_admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return [
        GatewayDetailResponse(
            **GatewayResponse.model_validate(gateway).model_dump(),
            slots=gateway.slots,
        )
        for gateway in gateway_service.list_gateways(db)
    ]


@router.post("", response_model=GatewayDetailResponse, status_code=status.HTTP_201_CREATED)
def provision_gateway(
    data: GatewayProvision,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    gateway = gateway_service.provision_gateway(db, data)
    return GatewayDetailResponse(
        **GatewayResponse.model_validate(gateway).model_dump(), slots=gateway.slots
    )


@router.get("/{gateway_id}", response_model=GatewayDetailResponse)
def get_gateway(
    gateway_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    gateway = gateway_service.get_gateway(db, gateway_id)
    return GatewayDetailResponse(
        **GatewayResponse.model_validate(gateway).model_dump(), slots=gateway.slots
    )


@router.post(
    "/{gateway_id}/configuration",
    response_model=PublishConfigurationResponse,
    status_code=status.HTTP_201_CREATED,
)
def publish_gateway_configuration(
    gateway_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = configuration_service.publish_configuration(db, gateway_id, admin.id)
    published_at = row.publicado_en
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=UTC)
    return PublishConfigurationResponse(
        gateway_id=row.pasarela_id,
        property_id=row.predio_id,
        configuration_version=row.version,
        published_at=published_at,
    )


@router.get("/me/configuration", response_model=GatewayConfigurationResponse)
def poll_gateway_configuration(
    response: Response,
    x_config_version: int | None = Header(default=None, alias="X-Config-Version", ge=0),
    x_bindings_revision: int | None = Header(default=None, alias="X-Bindings-Revision", ge=0),
    gateway: Gateway = Depends(validate_gateway_credential),
    db: Session = Depends(get_db),
):
    code, payload = configuration_service.poll_configuration(
        db, gateway, x_config_version, x_bindings_revision
    )
    if code == status.HTTP_304_NOT_MODIFIED:
        return Response(status_code=code)
    response.status_code = code
    return payload


@router.post(
    "/me/binding-candidates",
    response_model=BindingCandidateResponse,
    responses={200: {"model": BindingCandidateResponse}},
)
def submit_gateway_binding_candidate(
    data: BindingCandidateCreate,
    response: Response,
    x_event_id: str | None = Header(default=None, alias="X-Event-ID", min_length=1, max_length=128),
    gateway: Gateway = Depends(validate_gateway_credential),
    db: Session = Depends(get_db),
):
    if x_event_id is None:
        raise HTTPException(status_code=422, detail="X-Event-ID is required")
    record, binding_status, result_status = binding_service.submit_candidate(
        db, gateway, x_event_id, data
    )
    response.status_code = result_status
    submitted_at = record.propuesto_en
    if submitted_at.tzinfo is None:
        submitted_at = submitted_at.replace(tzinfo=UTC)
    return BindingCandidateResponse(
        candidate_id=record.id,
        slot_id=record.ranura_id,
        binding_status=binding_status,
        submitted_at=submitted_at,
    )


@router.post(
    "/me/binding-candidates/{candidate_id}/confirm",
    response_model=BindingConfirmationResponse,
)
def confirm_gateway_binding_candidate(
    candidate_id: int,
    data: BindingConfirmation,
    x_event_id: str | None = Header(default=None, alias="X-Event-ID", min_length=1, max_length=128),
    gateway: Gateway = Depends(validate_gateway_credential),
    db: Session = Depends(get_db),
):
    if x_event_id is None:
        raise HTTPException(status_code=422, detail="X-Event-ID is required")
    record, _result_status = binding_service.confirm_candidate(
        db, gateway, candidate_id, x_event_id, data
    )
    confirmed_at = record.confirmado_en
    if confirmed_at is None:
        raise HTTPException(status_code=409, detail="Binding candidate is not confirmed")
    if confirmed_at.tzinfo is None:
        confirmed_at = confirmed_at.replace(tzinfo=UTC)
    return BindingConfirmationResponse(
        candidate_id=record.id,
        slot_id=record.ranura_id,
        binding_status="confirmed",
        confirmed_at=confirmed_at,
    )


@router.post("/me/heartbeat", status_code=status.HTTP_204_NO_CONTENT)
def gateway_heartbeat(
    request: Request,
    gateway: Gateway = Depends(validate_gateway_credential),
    db: Session = Depends(get_db),
):
    if request.headers.get("content-length") not in (None, "0"):
        raise HTTPException(status_code=422, detail="Heartbeat must not include a body")
    heartbeat_service.record_heartbeat(db, gateway)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{gateway_id}/status", response_model=GatewayStatusResponse)
def admin_gateway_status(
    gateway_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    gateway = gateway_service.get_gateway(db, gateway_id)
    return GatewayStatusResponse.model_validate(
        heartbeat_service.build_status_payload(db, gateway, include_pending_identity=True)
    )


@router.post(
    "/{gateway_id}/update-authorizations",
    response_model=UpdateAuthorizationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_update_authorization(
    gateway_id: int,
    data: UpdateAuthorizationCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = update_service.create_authorization(db, gateway_id, admin.id, data)
    expires_at = row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    return UpdateAuthorizationResponse(
        authorization_id=row.authorization_id,
        image_version=row.image_version,
        image_digest=row.image_digest,
        expires_at=expires_at,
    )


@router.get("/me/update-authorization", response_model=UpdateAuthorizationResponse)
def get_update_authorization(
    gateway: Gateway = Depends(validate_gateway_credential),
    db: Session = Depends(get_db),
):
    row = update_service.get_active_authorization(db, gateway)
    if row is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    expires_at = row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    return UpdateAuthorizationResponse(
        authorization_id=row.authorization_id,
        image_version=row.image_version,
        image_digest=row.image_digest,
        expires_at=expires_at,
    )


@router.post("/me/update-confirmations", response_model=UpdateConfirmationResponse)
def confirm_update(
    data: UpdateConfirmationCreate,
    response: Response,
    x_event_id: str | None = Header(default=None, alias="X-Event-ID", min_length=1, max_length=128),
    gateway: Gateway = Depends(validate_gateway_credential),
    db: Session = Depends(get_db),
):
    if x_event_id is None:
        raise HTTPException(status_code=422, detail="X-Event-ID is required")
    row, code = update_service.record_confirmation(db, gateway, x_event_id, data)
    response.status_code = code
    recorded = row.creado_en
    if recorded.tzinfo is None:
        recorded = recorded.replace(tzinfo=UTC)
    return UpdateConfirmationResponse(
        authorization_id=row.authorization_id,
        image_version=row.image_version,
        image_digest=row.image_digest,
        result=row.result,
        recorded_at=recorded,
    )
