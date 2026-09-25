"""One-time gateway activation and controlled credential lifecycle."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import ActivationReference, Gateway

ACTIVATION_TTL = timedelta(hours=24)
def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _invalid_reference() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "invalid_activation_reference", "message": "Activation failed"},
    )


def _gateway_or_404(db: Session, gateway_id: int, *, lock: bool = False) -> Gateway:
    query = select(Gateway).where(
        Gateway.id == gateway_id, Gateway.eliminado_en.is_(None)
    )
    if lock:
        query = query.with_for_update()
    gateway = db.execute(query).scalar_one_or_none()
    if gateway is None:
        raise HTTPException(status_code=404, detail="Gateway not found")
    return gateway


def issue_reference(db: Session, gateway_id: int, issuer_id: int):
    gateway = _gateway_or_404(db, gateway_id, lock=True)
    if gateway.estado != "pending_activation":
        raise HTTPException(status_code=409, detail="Gateway is not awaiting activation")
    now = _now()
    reference = "ar_" + secrets.token_urlsafe(32)
    expires_at = now + ACTIVATION_TTL
    db.execute(
        update(ActivationReference)
        .where(
            ActivationReference.pasarela_id == gateway_id,
            ActivationReference.resultado == "issued",
        )
        .values(resultado="revoked", invalidado_en=now)
    )
    db.add(
        ActivationReference(
            pasarela_id=gateway_id,
            referencia_hash=_hash(reference),
            emitido_por_usuario_id=issuer_id,
            creado_en=now,
            expira_en=expires_at,
        )
    )
    db.commit()
    return reference, expires_at


def activate(db: Session, reference: str) -> tuple[Gateway, str]:
    now = _now()
    row = db.execute(
        select(ActivationReference).where(ActivationReference.referencia_hash == _hash(reference))
    ).scalar_one_or_none()
    if row is None:
        raise _invalid_reference()
    gateway = db.execute(
        select(Gateway)
        .where(
            Gateway.id == row.pasarela_id,
            Gateway.estado == "pending_activation",
            Gateway.credencial_hash.is_(None),
            Gateway.eliminado_en.is_(None),
        )
        .with_for_update()
    ).scalar_one_or_none()
    if gateway is None:
        raise _invalid_reference()
    consumed = db.execute(
        update(ActivationReference)
        .where(
            ActivationReference.id == row.id,
            ActivationReference.resultado == "issued",
            ActivationReference.usado_en.is_(None),
            ActivationReference.invalidado_en.is_(None),
            ActivationReference.expira_en > now,
        )
        .values(resultado="consumed", usado_en=now)
    )
    if consumed.rowcount != 1:
        raise _invalid_reference()
    credential = "gk_" + secrets.token_urlsafe(32)
    activated = db.execute(
        update(Gateway)
        .where(
            Gateway.id == gateway.id,
            Gateway.estado == "pending_activation",
            Gateway.credencial_hash.is_(None),
        )
        .values(
            estado="active",
            credencial_hash=_hash(credential),
            credencial_prefijo=credential[:12],
            activado_en=now,
        )
    )
    if activated.rowcount != 1:
        db.rollback()
        raise _invalid_reference()
    db.commit()
    db.refresh(gateway)
    return gateway, credential


def rotate_credential(db: Session, gateway_id: int) -> tuple[Gateway, str]:
    gateway = _gateway_or_404(db, gateway_id, lock=True)
    if gateway.estado != "active":
        raise HTTPException(status_code=409, detail="Only active gateways can rotate credentials")
    credential = "gk_" + secrets.token_urlsafe(32)
    now = _now()
    rotated = db.execute(
        update(Gateway)
        .where(Gateway.id == gateway_id, Gateway.estado == "active")
        .values(
            credencial_hash=_hash(credential),
            credencial_prefijo=credential[:12],
            actualizado_en=now,
        )
    )
    if rotated.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="Gateway credential could not be rotated")
    db.commit()
    db.refresh(gateway)
    return gateway, credential


def revoke_gateway(db: Session, gateway_id: int) -> Gateway:
    gateway = _gateway_or_404(db, gateway_id, lock=True)
    if gateway.estado == "revoked":
        return gateway
    now = _now()
    db.execute(
        update(Gateway)
        .where(Gateway.id == gateway_id, Gateway.estado.in_(["pending_activation", "active"]))
        .values(
            estado="revoked",
            revocado_en=now,
            credencial_hash=None,
            credencial_prefijo=None,
            actualizado_en=now,
        )
    )
    db.execute(
        update(ActivationReference)
        .where(
            ActivationReference.pasarela_id == gateway_id,
            ActivationReference.resultado == "issued",
        )
        .values(resultado="revoked", invalidado_en=now)
    )
    db.commit()
    db.refresh(gateway)
    return gateway
