"""Gateway-scoped physical binding candidate and confirmation state machine."""

import hashlib
import json
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Gateway, GatewayConfig, GatewaySlot, PhysicalBinding
from app.schemas.gateway_config import BindingCandidateCreate, BindingConfirmation


def _digest(data: dict) -> str:
    body = json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def _rfc3339_utc(value: str) -> datetime:
    if not value.endswith("Z"):
        raise HTTPException(status_code=422, detail="Timestamp must be RFC3339 UTC ending in Z")
    try:
        parsed = datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid RFC3339 timestamp") from exc
    return parsed.astimezone(UTC).replace(tzinfo=None)


def _gateway_config(db: Session, gateway: Gateway) -> GatewayConfig:
    if gateway.config_version_activa <= 0:
        raise HTTPException(status_code=409, detail="Gateway has no active configuration")
    row = db.execute(
        select(GatewayConfig).where(
            GatewayConfig.pasarela_id == gateway.id,
            GatewayConfig.predio_id == gateway.predio_id,
            GatewayConfig.version == gateway.config_version_activa,
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=409, detail="Active gateway configuration is unavailable")
    return row


def _authorized_slot(
    db: Session, gateway: Gateway, slot_id: int, node_id: int, area_id: int
) -> GatewaySlot:
    slot = db.execute(
        select(GatewaySlot).where(
            GatewaySlot.id == slot_id,
            GatewaySlot.pasarela_id == gateway.id,
            GatewaySlot.nodo_id == node_id,
            GatewaySlot.area_riego_id == area_id,
        )
    ).scalar_one_or_none()
    if slot is None:
        raise HTTPException(status_code=403, detail="Selected slot is outside gateway scope")
    snapshot = _gateway_config(db, gateway).snapshot
    allowed = any(
        item.get("slot_id") == slot_id
        and item.get("logical_node_id") == node_id
        and item.get("irrigation_area_id") == area_id
        for item in snapshot.get("slots", [])
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="Selected slot is not in active configuration")
    return slot


def _proposal_status(db: Session, gateway: Gateway, slot: GatewaySlot) -> str:
    pending = db.execute(
        select(PhysicalBinding.id).where(
            PhysicalBinding.pasarela_id == gateway.id,
            PhysicalBinding.ranura_id == slot.id,
            PhysicalBinding.estado == "pending",
        )
    ).scalar_one_or_none()
    if pending is not None:
        raise HTTPException(status_code=409, detail="A candidate is already pending for this slot")
    current = db.execute(
        select(PhysicalBinding.id).where(
            PhysicalBinding.pasarela_id == gateway.id,
            PhysicalBinding.ranura_id == slot.id,
            PhysicalBinding.estado == "confirmed",
        )
    ).scalar_one_or_none()
    return "pending_reassignment" if current is not None else "pending_initial"


def submit_candidate(
    db: Session, gateway: Gateway, event_id: str, data: BindingCandidateCreate
) -> tuple[PhysicalBinding, str, int]:
    gateway = _lock_gateway(db, gateway.id)
    digest = _digest(data.model_dump(mode="json"))
    replay = db.execute(
        select(PhysicalBinding).where(
            PhysicalBinding.pasarela_id == gateway.id,
            PhysicalBinding.evento_propuesta_id == event_id,
        )
    ).scalar_one_or_none()
    if replay is not None:
        if replay.hash_propuesta != digest:
            raise HTTPException(status_code=409, detail="Event identity was reused with another body")
        return replay, replay.estado_propuesta, status.HTTP_200_OK

    slot = _authorized_slot(
        db, gateway, data.slot_id, data.logical_node_id, data.irrigation_area_id
    )
    duplicate_uid = db.execute(
        select(PhysicalBinding.id).where(
            PhysicalBinding.pasarela_id == gateway.id,
            PhysicalBinding.uid == data.uid,
            PhysicalBinding.estado.in_(["pending", "confirmed"]),
        )
    ).scalar_one_or_none()
    if duplicate_uid is not None:
        raise HTTPException(status_code=409, detail="Physical UID is already assigned or pending")
    binding_status = _proposal_status(db, gateway, slot)
    record = PhysicalBinding(
        pasarela_id=gateway.id,
        ranura_id=slot.id,
        nodo_id=slot.nodo_id,
        area_riego_id=slot.area_riego_id,
        uid=data.uid,
        numero_serie=data.serial,
        estado="pending",
        evento_propuesta_id=event_id,
        hash_propuesta=digest,
        estado_propuesta=binding_status,
    )
    db.add(record)
    gateway.bindings_revision += 1
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Duplicate binding candidate") from exc
    db.refresh(record)
    return record, binding_status, status.HTTP_201_CREATED


def confirm_candidate(
    db: Session,
    gateway: Gateway,
    candidate_id: int,
    event_id: str,
    data: BindingConfirmation,
) -> tuple[PhysicalBinding, int]:
    gateway = _lock_gateway(db, gateway.id)
    digest = _digest(data.model_dump(mode="json"))
    replay = db.execute(
        select(PhysicalBinding).where(
            PhysicalBinding.pasarela_id == gateway.id,
            PhysicalBinding.evento_confirmacion_id == event_id,
        )
    ).scalar_one_or_none()
    if replay is not None:
        if replay.hash_confirmacion != digest or replay.id != candidate_id:
            raise HTTPException(status_code=409, detail="Event identity was reused with another body")
        return replay, status.HTTP_200_OK

    candidate = db.execute(
        select(PhysicalBinding)
        .where(
            PhysicalBinding.id == candidate_id,
            PhysicalBinding.pasarela_id == gateway.id,
        )
        .with_for_update()
    ).scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=404, detail="Binding candidate not found")
    if candidate.estado != "pending":
        raise HTTPException(status_code=409, detail="Binding candidate is no longer pending")
    _authorized_slot(db, gateway, data.slot_id, candidate.nodo_id, candidate.area_riego_id)
    if candidate.ranura_id != data.slot_id:
        raise HTTPException(status_code=403, detail="Candidate belongs to another selected slot")
    confirmed_at = _rfc3339_utc(data.technician_confirmed_at)
    proposed_at = candidate.propuesto_en.replace(tzinfo=None)
    if confirmed_at < proposed_at:
        raise HTTPException(status_code=409, detail="Confirmation predates the candidate")

    current_rows = list(
        db.scalars(
            select(PhysicalBinding)
            .where(
                PhysicalBinding.pasarela_id == gateway.id,
                PhysicalBinding.ranura_id == candidate.ranura_id,
                PhysicalBinding.estado == "confirmed",
            )
            .with_for_update()
        )
    )
    for current in current_rows:
        if current.confirmado_en and confirmed_at < current.confirmado_en.replace(tzinfo=None):
            raise HTTPException(status_code=409, detail="Confirmation predates current binding history")
        current.estado = "closed"
        current.cerrado_en = confirmed_at
    candidate.estado = "confirmed"
    candidate.confirmado_en = confirmed_at
    candidate.confirmado_por_pasarela_id = gateway.id
    candidate.evento_confirmacion_id = event_id
    candidate.hash_confirmacion = digest
    gateway.bindings_revision += 1
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Physical binding conflicts with active history") from exc
    db.refresh(candidate)
    return candidate, status.HTTP_200_OK


def _lock_gateway(db: Session, gateway_id: int) -> Gateway:
    gateway = db.execute(
        select(Gateway)
        .where(
            Gateway.id == gateway_id,
            Gateway.estado == "active",
            Gateway.eliminado_en.is_(None),
        )
        .with_for_update()
    ).scalar_one_or_none()
    if gateway is None:
        raise HTTPException(status_code=401, detail="Gateway is not active")
    return gateway
