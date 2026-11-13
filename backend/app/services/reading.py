import csv
import io
from datetime import UTC, date, datetime, time, timedelta, tzinfo
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException, status
from sqlalchemy import exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.crop_cycle import CropCycle
from app.models.alert import Alert
from app.models.gateway import Gateway
from app.models.gateway_config import GatewayConfig
from app.models.irrigation_area import IrrigationArea
from app.models.node import Node
from app.models.property import Property
from app.models.reading import Reading
from app.models.threshold import Threshold
from app.schemas.reading import ReadingCreate
from app.services.node import live_node_ids


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
        # Sin umbral activo no hay veredicto: el nivel queda en null y la UI muestra
        # "sin datos de umbral". "optimal" solo se emite con umbral y sin breach.
        level: str | None = None

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
            else:
                level = "optimal"

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


def parse_time_zone(tz: str | None) -> tzinfo:
    """Resolve the optional IANA ``tz`` query parameter; history defaults to UTC days."""
    if not tz:
        return UTC
    try:
        return ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown time zone '{tz}'",
        ) from None


def _day_start_utc(day: date, zone: tzinfo) -> datetime:
    """Instant (naive UTC, as stored) at which ``day`` starts in ``zone``."""
    return (
        datetime.combine(day, time.min, tzinfo=zone).astimezone(UTC).replace(tzinfo=None)
    )


def _as_local(timestamp: datetime, zone: tzinfo) -> datetime:
    """Stored naive-UTC timestamp as wall-clock time in ``zone`` (naive)."""
    return timestamp.replace(tzinfo=UTC).astimezone(zone).replace(tzinfo=None)


def _history_days(
    db: Session,
    start_date: date | None,
    end_date: date | None,
    crop_cycle_id: int | None,
) -> tuple[date | None, date | None]:
    """Calendar days the history covers: a crop cycle's dates win over start/end."""
    if crop_cycle_id is None:
        return start_date, end_date
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
    return cycle.fecha_inicio, cycle.fecha_fin


def _build_history_query(
    irrigation_area_id: int | None,
    node_ids: list[int] | None,
    start_date: date | None,
    end_date: date | None,
    crop_cycle_id: int | None,
    db: Session,
    zone: tzinfo = UTC,
):
    """Build WHERE conditions for history/export queries.

    Days are whole calendar days in ``zone`` (UTC by default)."""
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
    else:
        # Admin-wide history (e.g. "Lecturas hoy"): skip readings of deleted nodes, areas,
        # properties or clients, which keep their rows after a soft delete.
        conditions.append(Reading.nodo_id.in_(live_node_ids()))

    first_day, last_day = _history_days(db, start_date, end_date, crop_cycle_id)
    if first_day is not None:
        conditions.append(Reading.marca_tiempo >= _day_start_utc(first_day, zone))
    if last_day is not None:
        conditions.append(
            Reading.marca_tiempo < _day_start_utc(last_day + timedelta(days=1), zone)
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
    zone: tzinfo = UTC,
) -> tuple[list[Reading], int]:
    conditions = _build_history_query(
        irrigation_area_id, node_ids, start_date, end_date, crop_cycle_id, db, zone
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


def _as_datetime(value: datetime | date | str) -> datetime:
    if isinstance(value, str):
        return datetime.fromisoformat(value)
    if isinstance(value, datetime):
        return value
    return datetime.combine(value, time.min)


def get_readings_availability(
    db: Session,
    irrigation_area_id: int,
    month_start: date | None = None,
    zone: tzinfo = UTC,
) -> tuple[date | None, date | None, list[date]]:
    """Return min/max reading dates and available days for a month, as days in ``zone``."""
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

    min_day = _as_local(_as_datetime(min_ts), zone).date()
    max_day = _as_local(_as_datetime(max_ts), zone).date()

    current_month_start = (month_start or max_day).replace(day=1)
    next_month_start = (
        current_month_start.replace(day=28) + timedelta(days=4)
    ).replace(day=1)
    month_days = [
        current_month_start + timedelta(days=offset)
        for offset in range((next_month_start - current_month_start).days)
    ]
    # One indexed EXISTS per local day: SQL DATE() would group by UTC days, and the
    # database may have no time zone tables for CONVERT_TZ.
    has_readings = db.execute(
        select(
            *(
                exists()
                .where(
                    Reading.nodo_id == node_id,
                    Reading.marca_tiempo >= _day_start_utc(day, zone),
                    Reading.marca_tiempo
                    < _day_start_utc(day + timedelta(days=1), zone),
                )
                .label(f"d{index}")
                for index, day in enumerate(month_days)
            )
        )
    ).one()
    available_dates = [day for day, has in zip(month_days, has_readings) if has]

    return min_day, max_day, available_dates


# Export columns: Spanish header with unit, short PDF header, storage attribute and
# display decimals (``None`` = yes/no value). Same order and precision as the UI table.
EXPORT_COLUMNS: tuple[tuple[str, str, str, int | None], ...] = (
    ("Humedad del suelo (%)", "Hum. suelo\n(%)", "suelo_humedad", 1),
    ("Flujo de agua (L/min)", "Flujo\n(L/min)", "riego_flujo_por_minuto", 1),
    ("E.T.O. (mm/día)", "E.T.O.\n(mm/día)", "ambiental_eto", 2),
    ("Conductividad (dS/m)", "Conduct.\n(dS/m)", "suelo_conductividad", 2),
    ("Temperatura del suelo (°C)", "Temp. suelo\n(°C)", "suelo_temperatura", 1),
    ("Potencial hídrico (MPa)", "Pot. hídrico\n(MPa)", "suelo_potencial_hidrico", 2),
    ("Riego activo", "Riego\nactivo", "riego_activo", None),
    ("Litros acumulados (L)", "Acumulado\n(L)", "riego_litros_acumulados", 0),
    ("Temperatura del aire (°C)", "Temp. aire\n(°C)", "ambiental_temperatura", 1),
    ("Humedad relativa (%)", "H. relativa\n(%)", "ambiental_humedad_relativa", 0),
    ("Velocidad del viento (km/h)", "Viento\n(km/h)", "ambiental_velocidad_viento", 1),
    ("Radiación solar (W/m²)", "Radiación\n(W/m²)", "ambiental_radiacion_solar", 0),
)
NO_DATA = "Sin datos"


def _rounded(value: object, decimals: int) -> Decimal:
    result = Decimal(str(value)).quantize(Decimal(1).scaleb(-decimals), ROUND_HALF_UP)
    return abs(result) if result == 0 else result


def _yes_no(value: bool | None) -> str:
    if value is None:
        return NO_DATA
    return "Sí" if value else "No"


def _cell_text(value: object, decimals: int | None, empty: str) -> str:
    if decimals is None:
        return _yes_no(value)  # type: ignore[arg-type]
    return empty if value is None else str(_rounded(value, decimals))


def _zone_name(zone: tzinfo) -> str:
    return getattr(zone, "key", None) or str(zone)


def _export_context(
    db: Session,
    irrigation_area_id: int,
    start_date: date | None,
    end_date: date | None,
    crop_cycle_id: int | None,
    zone: tzinfo,
) -> tuple[str, str, list[Reading]]:
    """Predio and área names plus the readings matching the history filters."""
    conditions = _build_history_query(
        irrigation_area_id, None, start_date, end_date, crop_cycle_id, db, zone
    )
    names = db.execute(
        select(Property.nombre, IrrigationArea.nombre)
        .join(IrrigationArea, IrrigationArea.predio_id == Property.id)
        .where(IrrigationArea.id == irrigation_area_id)
    ).one_or_none()
    property_name, area_name = names or ("", "")
    readings = list(
        db.execute(
            select(Reading).where(*conditions).order_by(Reading.marca_tiempo.asc())
        ).scalars()
    )
    return property_name, area_name, readings


def export_readings_csv(
    db: Session,
    irrigation_area_id: int,
    start_date: date | None = None,
    end_date: date | None = None,
    crop_cycle_id: int | None = None,
    zone: tzinfo = UTC,
) -> str:
    """Export readings matching filters as a UTF-8 (BOM) CSV string in local time."""
    property_name, area_name, readings = _export_context(
        db, irrigation_area_id, start_date, end_date, crop_cycle_id, zone
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            f"Fecha y hora ({_zone_name(zone)})",
            "Predio",
            "Área",
            *(header for header, _, _, _ in EXPORT_COLUMNS),
        ]
    )
    for r in readings:
        writer.writerow(
            [
                _as_local(r.marca_tiempo, zone).strftime("%d/%m/%Y %H:%M:%S"),
                property_name,
                area_name,
                *(
                    _cell_text(getattr(r, attr), decimals, "")
                    for _, _, attr, decimals in EXPORT_COLUMNS
                ),
            ]
        )
    # The BOM lets spreadsheet programs read the accents and units as UTF-8.
    return "\ufeff" + output.getvalue()


def export_readings_xlsx(
    db: Session,
    irrigation_area_id: int,
    start_date: date | None = None,
    end_date: date | None = None,
    crop_cycle_id: int | None = None,
    zone: tzinfo = UTC,
) -> bytes:
    """Export readings as XLSX bytes in local time. Requires openpyxl."""
    from openpyxl import Workbook
    from openpyxl.styles import Font

    property_name, area_name, readings = _export_context(
        db, irrigation_area_id, start_date, end_date, crop_cycle_id, zone
    )

    wb = Workbook()
    ws = wb.active
    ws.title = "Lecturas"
    ws.append(
        [
            f"Fecha y hora ({_zone_name(zone)})",
            "Predio",
            "Área",
            *(header for header, _, _, _ in EXPORT_COLUMNS),
        ]
    )
    for cell in ws[1]:
        cell.font = Font(bold=True)
    ws.freeze_panes = "A2"
    for r in readings:
        row: list[object] = [_as_local(r.marca_tiempo, zone), property_name, area_name]
        for _, _, attr, decimals in EXPORT_COLUMNS:
            value = getattr(r, attr)
            if decimals is None:
                row.append(_yes_no(value))
            else:
                row.append(None if value is None else float(_rounded(value, decimals)))
        ws.append(row)
        cells = ws[ws.max_row]
        cells[0].number_format = "dd/mm/yyyy hh:mm:ss"
        for cell, (_, _, _, decimals) in zip(cells[3:], EXPORT_COLUMNS):
            if decimals is not None:
                cell.number_format = "0" if decimals == 0 else "0." + "0" * decimals
    ws.column_dimensions["A"].width = 22

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def export_readings_pdf(
    db: Session,
    irrigation_area_id: int,
    start_date: date | None = None,
    end_date: date | None = None,
    crop_cycle_id: int | None = None,
    zone: tzinfo = UTC,
) -> bytes:
    """Export readings as PDF bytes in local time. Requires reportlab."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import landscape, letter
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    from xml.sax.saxutils import escape

    property_name, area_name, readings = _export_context(
        db, irrigation_area_id, start_date, end_date, crop_cycle_id, zone
    )
    first_day, last_day = _history_days(db, start_date, end_date, crop_cycle_id)
    period = (
        f"{first_day.strftime('%d/%m/%Y') if first_day else 'desde el inicio'}"
        f" – {last_day.strftime('%d/%m/%Y') if last_day else 'sin fecha de fin'}"
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(letter))
    styles = getSampleStyleSheet()
    title = Paragraph(
        escape(f"Lecturas · {property_name} · {area_name}"), styles["Heading2"]
    )
    subtitle = Paragraph(
        escape(
            f"Periodo: {period} · Horas en {_zone_name(zone)} · "
            f"{len(readings)} registros"
        ),
        styles["Normal"],
    )
    headers = [
        f"Fecha y hora\n({_zone_name(zone)})",
        *(short for _, short, _, _ in EXPORT_COLUMNS),
    ]
    table_data = [headers]
    for r in readings:
        table_data.append(
            [
                _as_local(r.marca_tiempo, zone).strftime("%d/%m/%Y %H:%M"),
                *(
                    _cell_text(getattr(r, attr), decimals, NO_DATA)
                    for _, _, attr, decimals in EXPORT_COLUMNS
                ),
            ]
        )

    table = Table(table_data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    doc.build([title, subtitle, Spacer(1, 8), table])
    return buf.getvalue()
