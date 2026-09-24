from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.gateway_lifecycle import (
    ActivationReferenceResponse,
    GatewayActivationRequest,
    GatewayCredentialResponse,
)
from app.services import gateway_lifecycle as service

router = APIRouter(include_in_schema=False)


@router.post("/activate", response_model=GatewayCredentialResponse)
def activate_gateway(data: GatewayActivationRequest, db: Session = Depends(get_db)):
    try:
        gateway, credential = service.activate(db, data.activation_reference)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_401_UNAUTHORIZED:
            return JSONResponse(status_code=exc.status_code, content=exc.detail)
        raise
    return GatewayCredentialResponse(
        gateway_id=gateway.id, property_id=gateway.predio_id, credential=credential
    )


@router.post(
    "/{gateway_id}/activation-references",
    response_model=ActivationReferenceResponse,
    status_code=status.HTTP_201_CREATED,
)
def issue_activation_reference(
    gateway_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    reference, expires_at = service.issue_reference(db, gateway_id, admin.id)
    return ActivationReferenceResponse(activation_reference=reference, expires_at=expires_at)


@router.post(
    "/{gateway_id}/credentials/rotate",
    response_model=GatewayCredentialResponse,
    status_code=status.HTTP_201_CREATED,
)
def rotate_gateway_credential(
    gateway_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    gateway, credential = service.rotate_credential(db, gateway_id)
    return GatewayCredentialResponse(
        gateway_id=gateway.id, property_id=gateway.predio_id, credential=credential
    )


@router.post("/{gateway_id}/revoke", status_code=status.HTTP_204_NO_CONTENT)
def revoke_gateway(
    gateway_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    service.revoke_gateway(db, gateway_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
