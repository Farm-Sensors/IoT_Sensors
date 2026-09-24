import csv
import io
from datetime import UTC, date, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.crop_cycle import CropCycle
from app.models.alert import Alert
from app.models.gateway import Gateway
from app.models.gateway_config import GatewayConfig
from app.models.irrigation_area import IrrigationArea
from app.models.node import Node
from app.models.reading import Reading
from app.models.threshold import Threshold
from app.schemas.reading import ReadingCreate


PRIORITY_PARAMETERS = (
    "soil.humidity",
    "irrigation.flow_per_minute",
    "environmental.eto",
)


def _priority_level_from_severity(severity: str) -> str:
    if severity == "critical":
        return "critical"
    return "warning"


def _extract_threshold_value(reading: Reading, parameter: str) -> float | None:
    mapping = {
        "soil.conductivity": reading.suelo_conductividad,
        "soil.temperature": reading.suelo_temperatura,
        "soil.humidity": reading.suelo_humedad,
        "soil.water_potential": reading.suelo_potencial_hidrico,
        "irrigation.active": reading.riego_activo,
        "irrigation.accumulated_liters": reading.riego_litros_acumulados,
        "irrigation.flow_per_minute": reading.riego_flujo_por_minuto,
        "environmental.temperature": reading.ambiental_temperatura,
        "environmental.relative_humidity": reading.ambiental_humedad_relativa,
        "environmental.wind_speed": reading.ambiental_velocidad_viento,
        "environmental.solar_radiation": reading.ambiental_radiacion_solar,
        "environmental.eto": reading.ambiental_eto,
    }
    value = mapping.get(parameter)
    if value is None:
        return None
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    return float(value)


def _is_threshold_breached(
    value: float,
    min_value: float | None,
    max_value: float | None,
) -> bool:
    if min_value is not None and value < min_value:
        return True
    if max_value is not None and value > max_value:
        return True
    return False


def _has_recent_duplicate_threshold_alert(
    db: Session,
    *,
    node_id: int,
    irrigation_area_id: int,
    parameter: str,
    severity: str,
    timestamp: datetime,
    window_minutes: int = 10,
) -> bool:
    if window_minutes <= 0:
        return False

    window_start = timestamp - timedelta(minutes=window_minutes)
    existing = db.execute(
        select(Alert.id).where(
            Alert.nodo_id == node_id,
            Alert.area_riego_id == irrigation_area_id,
            Alert.tipo == "threshold",
            Alert.parametro == parameter,
            Alert.severidad == severity,
            Alert.marca_tiempo >= window_start,
        )
    ).scalar_one_or_none()
    return existing is not None


def _create_threshold_alerts(db: Session, node: Node, reading: Reading) -> None:
    thresholds = list(
        db.execute(
            select(Threshold).where(
                Threshold.area_riego_id == node.area_riego_id,
                Threshold.activo.is_(True),
                Threshold.eliminado_en.is_(None),
            )
        ).scalars()
    )

    for threshold in thresholds:
        value = _extract_threshold_value(reading, threshold.parametro)
        if value is None:
            continue

        min_value = (
            float(threshold.rango_min) if threshold.rango_min is not None else None
        )
        max_value = (
            float(threshold.rango_max) if threshold.rango_max is not None else None
        )
        if not _is_threshold_breached(value, min_value, max_value):
            continue

        if _has_recent_duplicate_threshold_alert(
            db,
            node_id=node.id,
            irrigation_area_id=node.area_riego_id,
            parameter=threshold.parametro,
            severity=threshold.severidad,
            timestamp=reading.marca_tiempo,
            window_minutes=settings.ALERT_THRESHOLD_DUPLICATE_WINDOW_MINUTES,
        ):
            continue

        alert = Alert(
            nodo_id=node.id,
            area_riego_id=node.area_riego_id,
            umbral_id=threshold.id,
            tipo="threshold",
            parametro=threshold.parametro,
            valor_detectado=value,
            severidad=threshold.severidad,
            mensaje=f"{threshold.parametro} fuera de umbral ({value})",
            marca_tiempo=reading.marca_tiempo,
            leida=False,
            notificada_email=False,
            notificada_whatsapp=False,
        )
        db.add(alert)


def _configured_node(db: Session, gateway: Gateway, logical_node_id: int) -> Node:
    if gateway.config_version_activa <= 0:
        raise HTTPException(status_code=403, detail="Logical node is outside gateway scope")
    config = db.execute(
        select(GatewayConfig).where(
            GatewayConfig.pasarela_id == gateway.id,
            GatewayConfig.predio_id == gateway.predio_id,
            GatewayConfig.version == gateway.config_version_activa,
        )
    ).scalar_one_or_none()
    configured_slot = next(
        (
            item
            for item in (config.snapshot.get("slots", []) if config else [])
            if item.get("logical_node_id") == logical_node_id
        ),
        None,
    )
    if configured_slot is None:
        raise HTTPException(status_code=403, detail="Logical node is outside gateway scope")

    node = db.execute(
        select(Node)
        .join(IrrigationArea, IrrigationArea.id == Node.area_riego_id)
        .where(
            Node.id == logical_node_id,
            Node.area_riego_id == configured_slot.get("irrigation_area_id"),
            Node.activo.is_(True),
            Node.eliminado_en.is_(None),
            IrrigationArea.predio_id == gateway.predio_id,
            IrrigationArea.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if node is None:
        raise HTTPException(status_code=403, detail="Logical node is outside gateway scope")
    return node


def ingest_reading(
    db: Session,
    gateway: Gateway,
    logical_node_id: int,
    data: ReadingCreate,
    event_id: str,
    payload_hash: str,
) -> tuple[Reading, bool]:
    """Bind a telemetry event to one reading; return (reading, created)."""
    node = _configured_node(db, gateway, logical_node_id)
    node_id = node.id
    query = select(Reading).where(
        Reading.pasarela_id == gateway.id,
        Reading.nodo_id == node_id,
        Reading.event_id == event_id,
    )
    existing = db.execute(query).scalar_one_or_none()
    if existing is None:
        try:
            return create_reading(
                db,
                node,
                data,
                event_id=event_id,
                payload_hash=payload_hash,
                gateway_id=gateway.id,
            ), True
        except IntegrityError:
            # A concurrent request may have committed the same event. Roll back
            # all writes and start a fresh snapshot (also on MySQL REPEATABLE READ).
            db.rollback()
            existing = db.execute(query).scalar_one_or_none()
            if existing is None:
                raise  # An unrelated constraint failure must not become a retry.
    if existing.payload_hash != payload_hash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="X-Event-ID already used with a different body",
        )
    return existing, False


def create_reading(
    db: Session,
    node: Node,
    data: ReadingCreate,
    *,
    event_id: str | None = None,
    payload_hash: str | None = None,
    gateway_id: int | None = None,
) -> Reading:
    """Insert reading in a single table."""
    now = datetime.now(UTC).replace(tzinfo=None)
    suspicious = data.timestamp > now + timedelta(hours=1) or data.timestamp < now - timedelta(days=30)
    reading = Reading(
        nodo_id=node.id,
        pasarela_id=gateway_id,
        event_id=event_id,
        payload_hash=payload_hash,
        marca_tiempo_sospechosa=suspicious,
        marca_tiempo=data.timestamp,
        suelo_conductividad=data.soil.conductivity,
        suelo_temperatura=data.soil.temperature,
        suelo_humedad=data.soil.humidity,
        suelo_potencial_hidrico=data.soil.water_potential,
        riego_activo=data.irrigation.active,
        riego_litros_acumulados=data.irrigation.accumulated_liters,
        riego_flujo_por_minuto=data.irrigation.flow_per_minute,
        ambiental_temperatura=data.environmental.temperature,
        ambiental_humedad_relativa=data.environmental.relative_humidity,
        ambiental_velocidad_viento=data.environmental.wind_speed,
        ambiental_radiacion_solar=data.environmental.solar_radiation,
        ambiental_eto=data.environmental.eto,
    )
    db.add(reading)
    db.flush()

    if settings.ALERTS_ENABLED:
        _create_threshold_alerts(db, node, reading)

    db.commit()
    db.refresh(reading)
    return reading


def get_latest_reading(db: Session, irrigation_area_id: int) -> Reading | None:
    """Get the most recent reading for an irrigation area's node."""
    node = db.execute(
        select(Node).where(
            Node.area_riego_id == irrigation_area_id,
            Node.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No node found for irrigation area {irrigation_area_id}",
        )

    reading = db.execute(
        select(Reading)
        .where(Reading.nodo_id == node.id)
        .order_by(Reading.marca_tiempo.desc())
        .limit(1)
    ).scalar_one_or_none()
    return reading


def get_priority_status(db: Session, irrigation_area_id: int) -> dict[str, object]:
    """Return semaphore status for priority parameters using latest reading + thresholds."""
    node = db.execute(
        select(Node).where(
            Node.area_riego_id == irrigation_area_id,
            Node.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No node found for irrigation area {irrigation_area_id}",
        )

    latest = db.execute(
        select(Reading)
        .where(Reading.nodo_id == node.id)
        .order_by(Reading.marca_tiempo.desc())
        .limit(1)
    ).scalar_one_or_none()

    thresholds = list(
        db.execute(
            select(Threshold).where(
                Threshold.area_riego_id == irrigation_area_id,
                Threshold.activo.is_(True),
                Threshold.eliminado_en.is_(None),
                Threshold.parametro.in_(list(PRIORITY_PARAMETERS)),
            )
        ).scalars()
    )
    threshold_by_parameter = {t.parametro: t for t in thresholds}

    items: list[dict[str, object]] = []
    for parameter in PRIORITY_PARAMETERS:
        threshold = threshold_by_parameter.get(parameter)
        value = (
            _extract_threshold_value(latest, parameter) if latest is not None else None
        )

        threshold_id: int | None = None
        threshold_severity: str | None = None
        min_value: float | None = None
        max_value: float | None = None
        breached = False
        level = "optimal"

        if threshold is not None:
            threshold_id = threshold.id
            threshold_severity = threshold.severidad
            min_value = (
                float(threshold.rango_min) if threshold.rango_min is not None else None
            )
            max_value = (
                float(threshold.rango_max) if threshold.rango_max is not None else None
            )
            if value is not None and _is_threshold_breached(
                value=value,
                min_value=min_value,
                max_value=max_value,
            ):
                breached = True
                level = _priority_level_from_severity(threshold.severidad)

        items.append(
            {
                "parameter": parameter,
                "level": level,
                "current_value": value,
                "breached": breached,
                "threshold_id": threshold_id,
                "min_value": min_value,
                "max_value": max_value,
                "threshold_severity": threshold_severity,
            }
        )

    return {
        "irrigation_area_id": irrigation_area_id,
        "reading_timestamp": latest.marca_tiempo if latest is not None else None,
        "items": items,
    }


def _build_history_query(
    irrigation_area_id: int | None,
    node_ids: list[int] | None,
    start_date: date | None,
    end_date: date | None,
    crop_cycle_id: int | None,
    db: Session,
):
    """Build WHERE conditions for history/export queries."""
    conditions = []

    if node_ids is not None:
        conditions.append(Reading.nodo_id.in_(node_ids))
    elif irrigation_area_id is not None:
        node = db.execute(
            select(Node.id).where(
                Node.area_riego_id == irrigation_area_id,
                Node.eliminado_en.is_(None),
            )
        ).scalar_one_or_none()
        if node is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No node found for irrigation area {irrigation_area_id}",
            )
        conditions.append(Reading.nodo_id == node)

    # If crop_cycle_id is specified, use its dates
    if crop_cycle_id is not None:
        cycle = db.execute(
            select(CropCycle).where(
                CropCycle.id == crop_cycle_id,
                CropCycle.eliminado_en.is_(None),
            )
        ).scalar_one_or_none()
        if cycle is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Crop cycle with id {crop_cycle_id} not found",
            )
        conditions.append(
            Reading.marca_tiempo
            >= datetime.combine(cycle.fecha_inicio, datetime.min.time())
        )
        if cycle.fecha_fin is not None:
            conditions.append(
                Reading.marca_tiempo
                <= datetime.combine(cycle.fecha_fin, datetime.max.time())
            )
    else:
        if start_date is not None:
            conditions.append(
                Reading.marca_tiempo
                >= datetime.combine(start_date, datetime.min.time())
            )
        if end_date is not None:
            conditions.append(
                Reading.marca_tiempo <= datetime.combine(end_date, datetime.max.time())
            )

    return conditions


def list_readings(
    db: Session,
    page: int,
    per_page: int,
    irrigation_area_id: int | None = None,
    node_ids: list[int] | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    crop_cycle_id: int | None = None,
) -> tuple[list[Reading], int]:
    conditions = _build_history_query(
        irrigation_area_id, node_ids, start_date, end_date, crop_cycle_id, db
    )

    count_query = select(func.count()).select_from(Reading).where(*conditions)
    total = db.execute(count_query).scalar() or 0

    query = (
        select(Reading)
        .where(*conditions)
        .order_by(Reading.marca_tiempo.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    items = list(db.execute(query).scalars())
    return items, total


def get_readings_availability(
    db: Session,
    irrigation_area_id: int,
    month_start: date | None = None,
) -> tuple[date | None, date | None, list[date]]:
    """Return min/max reading dates and available days for a month."""
    node_id = db.execute(
        select(Node.id).where(
            Node.area_riego_id == irrigation_area_id,
            Node.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if node_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No node found for irrigation area {irrigation_area_id}",
        )

    min_ts, max_ts = db.execute(
        select(func.min(Reading.marca_tiempo), func.max(Reading.marca_tiempo)).where(
            Reading.nodo_id == node_id
        )
    ).one()

    if min_ts is None or max_ts is None:
        return None, None, []

    if isinstance(min_ts, str):
        min_ts = datetime.fromisoformat(min_ts)
    elif isinstance(min_ts, date) and not isinstance(min_ts, datetime):
        min_ts = datetime.combine(min_ts, datetime.min.time())

    if isinstance(max_ts, str):
        max_ts = datetime.fromisoformat(max_ts)
    elif isinstance(max_ts, date) and not isinstance(max_ts, datetime):
        max_ts = datetime.combine(max_ts, datetime.min.time())

    current_month_start = (month_start or max_ts.date()).replace(day=1)
    next_month_start = (
        current_month_start.replace(day=28) + timedelta(days=4)
    ).replace(day=1)
    current_month_end = next_month_start - timedelta(days=1)

    month_dates_raw = list(
        db.execute(
            select(func.date(Reading.marca_tiempo))
            .where(
                Reading.nodo_id == node_id,
                Reading.marca_tiempo
                >= datetime.combine(current_month_start, datetime.min.time()),
                Reading.marca_tiempo
                <= datetime.combine(current_month_end, datetime.max.time()),
            )
            .group_by(func.date(Reading.marca_tiempo))
            .order_by(func.date(Reading.marca_tiempo))
        ).scalars()
    )

    available_dates: list[date] = []
    for d in month_dates_raw:
        if isinstance(d, date):
            available_dates.append(d)
        elif isinstance(d, datetime):
            available_dates.append(d.date())
        elif isinstance(d, str):
            available_dates.append(date.fromisoformat(d))

    return min_ts.date(), max_ts.date(), available_dates


def export_readings_csv(
    db: Session,
    irrigation_area_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    crop_cycle_id: int | None = None,
) -> str:
    """Export readings matching filters as CSV string."""
    conditions = _build_history_query(
        irrigation_area_id, None, start_date, end_date, crop_cycle_id, db
    )
    readings = list(
        db.execute(
            select(Reading).where(*conditions).order_by(Reading.marca_tiempo.asc())
        ).scalars()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "timestamp",
            "node_id",
            "soil_conductivity",
            "soil_temperature",
            "soil_humidity",
            "soil_water_potential",
            "irrigation_active",
            "irrigation_accumulated_liters",
            "irrigation_flow_per_minute",
            "env_temperature",
            "env_relative_humidity",
            "env_wind_speed",
            "env_solar_radiation",
            "env_eto",
        ]
    )
    for r in readings:
        writer.writerow(
            [
                r.marca_tiempo.isoformat(),
                r.nodo_id,
                r.suelo_conductividad,
                r.suelo_temperatura,
                r.suelo_humedad,
                r.suelo_potencial_hidrico,
                r.riego_activo,
                r.riego_litros_acumulados,
                r.riego_flujo_por_minuto,
                r.ambiental_temperatura,
                r.ambiental_humedad_relativa,
                r.ambiental_velocidad_viento,
                r.ambiental_radiacion_solar,
                r.ambiental_eto,
            ]
        )
    return output.getvalue()


def export_readings_xlsx(
    db: Session,
    irrigation_area_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    crop_cycle_id: int | None = None,
) -> bytes:
    """Export readings as XLSX bytes. Requires openpyxl."""
    from openpyxl import Workbook

    conditions = _build_history_query(
        irrigation_area_id, None, start_date, end_date, crop_cycle_id, db
    )
    readings = list(
        db.execute(
            select(Reading).where(*conditions).order_by(Reading.marca_tiempo.asc())
        ).scalars()
    )

    wb = Workbook()
    ws = wb.active
    ws.title = "Readings"
    headers = [
        "timestamp",
        "node_id",
        "soil_conductivity",
        "soil_temperature",
        "soil_humidity",
        "soil_water_potential",
        "irrigation_active",
        "irrigation_accumulated_liters",
        "irrigation_flow_per_minute",
        "env_temperature",
        "env_relative_humidity",
        "env_wind_speed",
        "env_solar_radiation",
        "env_eto",
    ]
    ws.append(headers)
    for r in readings:
        ws.append(
            [
                r.marca_tiempo.isoformat(),
                r.nodo_id,
                (
                    float(r.suelo_conductividad)
                    if r.suelo_conductividad is not None
                    else None
                ),
                float(r.suelo_temperatura) if r.suelo_temperatura is not None else None,
                float(r.suelo_humedad) if r.suelo_humedad is not None else None,
                (
                    float(r.suelo_potencial_hidrico)
                    if r.suelo_potencial_hidrico is not None
                    else None
                ),
                r.riego_activo,
                (
                    float(r.riego_litros_acumulados)
                    if r.riego_litros_acumulados is not None
                    else None
                ),
                (
                    float(r.riego_flujo_por_minuto)
                    if r.riego_flujo_por_minuto is not None
                    else None
                ),
                (
                    float(r.ambiental_temperatura)
                    if r.ambiental_temperatura is not None
                    else None
                ),
                (
                    float(r.ambiental_humedad_relativa)
                    if r.ambiental_humedad_relativa is not None
                    else None
                ),
                (
                    float(r.ambiental_velocidad_viento)
                    if r.ambiental_velocidad_viento is not None
                    else None
                ),
                (
                    float(r.ambiental_radiacion_solar)
                    if r.ambiental_radiacion_solar is not None
                    else None
                ),
                float(r.ambiental_eto) if r.ambiental_eto is not None else None,
            ]
        )

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def export_readings_pdf(
    db: Session,
    irrigation_area_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    crop_cycle_id: int | None = None,
) -> bytes:
    """Export readings as PDF bytes. Requires reportlab."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import landscape, letter
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle

    conditions = _build_history_query(
        irrigation_area_id, None, start_date, end_date, crop_cycle_id, db
    )
    readings = list(
        db.execute(
            select(Reading).where(*conditions).order_by(Reading.marca_tiempo.asc())
        ).scalars()
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(letter))
    headers = [
        "Timestamp",
        "Node",
        "Cond.",
        "Temp.S",
        "Hum.S",
        "W.Pot",
        "Active",
        "Liters",
        "Flow",
        "Temp.E",
        "RH%",
        "Wind",
        "Solar",
        "ETo",
    ]
    table_data = [headers]
    for r in readings:
        table_data.append(
            [
                r.marca_tiempo.strftime("%Y-%m-%d %H:%M"),
                r.nodo_id,
                r.suelo_conductividad if r.suelo_conductividad is not None else "",
                r.suelo_temperatura if r.suelo_temperatura is not None else "",
                r.suelo_humedad if r.suelo_humedad is not None else "",
                (
                    r.suelo_potencial_hidrico
                    if r.suelo_potencial_hidrico is not None
                    else ""
                ),
                "On" if r.riego_activo else "Off",
                (
                    r.riego_litros_acumulados
                    if r.riego_litros_acumulados is not None
                    else ""
                ),
                (
                    r.riego_flujo_por_minuto
                    if r.riego_flujo_por_minuto is not None
                    else ""
                ),
                r.ambiental_temperatura if r.ambiental_temperatura is not None else "",
                (
                    r.ambiental_humedad_relativa
                    if r.ambiental_humedad_relativa is not None
                    else ""
                ),
                (
                    r.ambiental_velocidad_viento
                    if r.ambiental_velocidad_viento is not None
                    else ""
                ),
                (
                    r.ambiental_radiacion_solar
                    if r.ambiental_radiacion_solar is not None
                    else ""
                ),
                r.ambiental_eto if r.ambiental_eto is not None else "",
            ]
        )

    table = Table(table_data)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    doc.build([table])
    return buf.getvalue()
