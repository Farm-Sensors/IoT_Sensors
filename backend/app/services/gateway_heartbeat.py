from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.gateway import Gateway
from app.models.physical_binding import PhysicalBinding
from app.models.reading import Reading

EDGE_STATUS = {
    "inactive": "pending",
    "never_seen": "pending",
    "recently_seen": "connected",
    "stale": "delayed",
    "disconnected": "disconnected",
}


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def compute_gateway_status(gateway: Gateway, *, now: datetime | None = None) -> str:
    if gateway.estado != "active":
        return "inactive"
    heartbeat = _aware(gateway.ultimo_heartbeat_en)
    if heartbeat is None:
        return "never_seen"
    current = now or datetime.now(UTC)
    if current.tzinfo is None:
        current = current.replace(tzinfo=UTC)
    age = (current - heartbeat).total_seconds()
    if age <= settings.GATEWAY_STATUS_RECENT_SECONDS:
        return "recently_seen"
    if age <= settings.GATEWAY_STATUS_STALE_SECONDS:
        return "stale"
    return "disconnected"


def record_heartbeat(db: Session, gateway: Gateway) -> None:
    gateway.ultimo_heartbeat_en = datetime.now(UTC).replace(tzinfo=None)
    db.commit()


def build_status_payload(db: Session, gateway: Gateway, *, include_pending_identity: bool) -> dict:
    cloud_status = compute_gateway_status(gateway)
    slots = []
    for slot in gateway.slots:
        binding = db.execute(
            select(PhysicalBinding)
            .where(
                PhysicalBinding.ranura_id == slot.id,
                PhysicalBinding.cerrado_en.is_(None),
                PhysicalBinding.estado.in_(("pending", "confirmed")),
            )
            .order_by(PhysicalBinding.id.desc())
        ).scalars().first()
        latest = None
        if slot.nodo_id:
            latest = db.execute(
                select(Reading.marca_tiempo)
                .where(Reading.nodo_id == slot.nodo_id)
                .order_by(Reading.marca_tiempo.desc())
            ).first()
        item = {
            "logical_node_id": slot.nodo_id,
            "irrigation_area_id": slot.area_riego_id,
            "binding_status": binding.estado if binding else "unbound",
            "latest_reading_at": _aware(latest[0]) if latest else None,
        }
        if include_pending_identity and binding is not None:
            item["bound_uid"] = binding.uid
            item["bound_serial"] = binding.numero_serie
        slots.append(item)
    last_heartbeat = _aware(gateway.ultimo_heartbeat_en)
    return {
        "gateway_id": gateway.id,
        "status": cloud_status,
        "edge_status": EDGE_STATUS[cloud_status],
        "last_heartbeat_at": last_heartbeat,
        "config_version": gateway.config_version_activa,
        "slots": slots,
    }


def get_property_gateway(db: Session, property_id: int) -> Gateway:
    gateway = db.execute(
        select(Gateway)
        .options(selectinload(Gateway.slots))
        .where(
            Gateway.predio_id == property_id,
            Gateway.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if gateway is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gateway not found")
    return gateway
