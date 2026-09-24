from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.gateway import (
    GatewayDetailResponse,
    GatewayProvision,
    GatewayResponse,
)
from app.services import gateway as gateway_service

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
