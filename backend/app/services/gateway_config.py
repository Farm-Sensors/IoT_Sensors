"""Immutable gateway configuration publication and conditional machine polling."""

from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Gateway, GatewayConfig, GatewaySlot, HardwareProfile, PhysicalBinding


def _utc(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def publish_configuration(db: Session, gateway_id: int, publisher_id: int) -> GatewayConfig:
    db.flush()
    gateway = db.execute(
        select(Gateway)
        .where(Gateway.id == gateway_id, Gateway.eliminado_en.is_(None))
        .with_for_update()
    ).scalar_one_or_none()
    if gateway is None:
        raise HTTPException(status_code=404, detail="Gateway not found")

    slots = db.execute(
        select(GatewaySlot, HardwareProfile.codigo)
        .outerjoin(HardwareProfile, HardwareProfile.id == GatewaySlot.perfil_hardware_id)
        .where(GatewaySlot.pasarela_id == gateway.id)
        .order_by(GatewaySlot.id)
    ).all()
    snapshot = {
        "gateway_id": gateway.id,
        "property_id": gateway.predio_id,
        "slots": [
            {
                "slot_id": slot.id,
                "logical_node_id": slot.nodo_id,
                "irrigation_area_id": slot.area_riego_id,
                "hardware_profile_code": profile_code,
            }
            for slot, profile_code in slots
        ],
    }
    version = gateway.config_version_activa + 1
    configuration = GatewayConfig(
        predio_id=gateway.predio_id,
        pasarela_id=gateway.id,
        version=version,
        snapshot=snapshot,
        publicado_por_usuario_id=publisher_id,
    )
    db.add(configuration)
    gateway.config_version_activa = version
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(configuration)
    return configuration


def _overlay(db: Session, gateway: Gateway, snapshot: dict) -> dict:
    result = []
    for configured_slot in snapshot.get("slots", []):
        slot_id = configured_slot["slot_id"]
        rows = list(
            db.scalars(
                select(PhysicalBinding)
                .where(
                    PhysicalBinding.pasarela_id == gateway.id,
                    PhysicalBinding.ranura_id == slot_id,
                    PhysicalBinding.estado.in_(["pending", "confirmed"]),
                )
                .order_by(PhysicalBinding.id)
            )
        )
        current = next((item for item in rows if item.estado == "confirmed"), None)
        pending = next((item for item in reversed(rows) if item.estado == "pending"), None)
        if pending is not None:
            binding_status = "pending_reassignment" if current else "pending_initial"
        else:
            binding_status = "confirmed" if current else "unbound"
        result.append(
            {
                "slot_id": slot_id,
                "logical_node_id": configured_slot["logical_node_id"],
                "irrigation_area_id": configured_slot["irrigation_area_id"],
                "binding_status": binding_status,
                "current_binding": (
                    {
                        "uid": current.uid,
                        "serial": current.numero_serie,
                        "proposed_at": _utc(current.propuesto_en),
                        "confirmed_at": _utc(current.confirmado_en),
                    }
                    if current
                    else None
                ),
                "pending_binding": (
                    {
                        "uid": pending.uid,
                        "serial": pending.numero_serie,
                        "proposed_at": _utc(pending.propuesto_en),
                        "confirmed_at": None,
                    }
                    if pending
                    else None
                ),
            }
        )
    return {"slots": result}


def poll_configuration(
    db: Session,
    gateway: Gateway,
    config_version: int | None,
    bindings_revision: int | None,
) -> tuple[int, dict | None]:
    if gateway.config_version_activa == 0:
        raise HTTPException(status_code=404, detail="No configuration has been published")
    row = db.execute(
        select(GatewayConfig).where(
            GatewayConfig.pasarela_id == gateway.id,
            GatewayConfig.predio_id == gateway.predio_id,
            GatewayConfig.version == gateway.config_version_activa,
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=409, detail="Active gateway configuration is unavailable")
    if (
        config_version is not None
        and bindings_revision is not None
        and config_version == gateway.config_version_activa
        and bindings_revision == gateway.bindings_revision
    ):
        return 304, None
    payload = {
        "configuration_version": row.version,
        "bindings_revision": gateway.bindings_revision,
        "property_id": gateway.predio_id,
        "configuration": row.snapshot,
        "binding_overlay": _overlay(db, gateway, row.snapshot),
    }
    return 200, payload
