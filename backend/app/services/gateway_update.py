import hashlib
import json
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.gateway import Gateway
from app.models.gateway_update import GatewayUpdateAuthorization, GatewayUpdateConfirmation
from app.schemas.gateway_update import UpdateAuthorizationCreate, UpdateConfirmationCreate


def _naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


def create_authorization(
    db: Session, gateway_id: int, admin_id: int, data: UpdateAuthorizationCreate
) -> GatewayUpdateAuthorization:
    gateway = db.get(Gateway, gateway_id)
    if gateway is None or gateway.eliminado_en is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gateway not found")
    row = GatewayUpdateAuthorization(
        pasarela_id=gateway_id,
        authorization_id=str(uuid.uuid4()),
        image_version=data.image_version,
        image_digest=data.image_digest,
        expires_at=_naive(data.expires_at),
        emitido_por_usuario_id=admin_id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_active_authorization(db: Session, gateway: Gateway) -> GatewayUpdateAuthorization | None:
    now = datetime.now(UTC).replace(tzinfo=None)
    return db.execute(
        select(GatewayUpdateAuthorization)
        .where(
            GatewayUpdateAuthorization.pasarela_id == gateway.id,
            GatewayUpdateAuthorization.consumido_en.is_(None),
            GatewayUpdateAuthorization.expires_at > now,
        )
        .order_by(GatewayUpdateAuthorization.id.desc())
    ).scalars().first()


def record_confirmation(
    db: Session,
    gateway: Gateway,
    event_id: str,
    data: UpdateConfirmationCreate,
) -> tuple[GatewayUpdateConfirmation, int]:
    payload = {
        "authorization_id": data.authorization_id,
        "image_version": data.image_version,
        "image_digest": data.image_digest,
        "technician_confirmed_at": data.technician_confirmed_at.isoformat(),
        "result": data.result,
    }
    payload_hash = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    existing = db.execute(
        select(GatewayUpdateConfirmation).where(
            GatewayUpdateConfirmation.pasarela_id == gateway.id,
            GatewayUpdateConfirmation.event_id == event_id,
        )
    ).scalar_one_or_none()
    if existing is not None:
        if existing.payload_hash == payload_hash:
            return existing, status.HTTP_200_OK
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Conflicting update confirmation")

    authorization = db.execute(
        select(GatewayUpdateAuthorization).where(
            GatewayUpdateAuthorization.authorization_id == data.authorization_id
        )
    ).scalar_one_or_none()
    if authorization is None or authorization.pasarela_id != gateway.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Authorization is not visible")
    now = datetime.now(UTC).replace(tzinfo=None)
    if authorization.consumido_en is not None or authorization.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Authorization is not active")
    if (
        authorization.image_version != data.image_version
        or authorization.image_digest != data.image_digest
    ):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Image identity does not match")

    row = GatewayUpdateConfirmation(
        pasarela_id=gateway.id,
        authorization_id=data.authorization_id,
        event_id=event_id,
        image_version=data.image_version,
        image_digest=data.image_digest,
        technician_confirmed_at=_naive(data.technician_confirmed_at),
        result=data.result,
        payload_hash=payload_hash,
    )
    authorization.consumido_en = now
    db.add(row)
    db.commit()
    db.refresh(row)
    return row, status.HTTP_201_CREATED
