import hashlib
import json
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.authz import get_client_area_ids, validate_area_access
from app.core.deps import get_current_user, validate_gateway_credential
from app.db.session import get_db
from app.models.gateway import Gateway
from app.models.node import Node
from app.models.user import User
from app.schemas.base import PaginatedResponse
from app.schemas.reading import (
    PriorityStatusResponse,
    ReadingAvailabilityResponse,
    ReadingCreate,
    ReadingCreateResponse,
    ReadingResponse,
)
from app.services import reading as reading_service

router = APIRouter()


def _get_client_node_ids(user: User, db: Session) -> list[int]:
    area_ids = get_client_area_ids(user, db)
    if not area_ids:
        return []
    return list(
        db.execute(
            select(Node.id).where(
                Node.area_riego_id.in_(area_ids),
                Node.eliminado_en.is_(None),
            )
        ).scalars()
    )


# ---------- POST (gateway-authenticated telemetry ingestion) ----------


async def _reading_payload_hash(request: Request) -> str:
    # Compare the submitted JSON, before schema defaults/coercions and database
    # decimal rounding. Whitespace and object key order are not body changes.
    canonical = json.dumps(await request.json(), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


@router.post(
    "",
    response_model=ReadingCreateResponse,
    status_code=201,
    responses={
        200: {"model": ReadingCreateResponse, "description": "Exact event retry"},
        409: {"description": "Event ID reused with a different body"},
    },
)
def create_reading(
    data: ReadingCreate,
    response: Response,
    event_id: UUID = Header(..., alias="X-Event-ID"),
    payload_hash: str = Depends(_reading_payload_hash),
    logical_node_id: int = Header(..., alias="X-Logical-Node-Id"),
    gateway: Gateway = Depends(validate_gateway_credential),
    db: Session = Depends(get_db),
):
    reading, created = reading_service.ingest_reading(
        db, gateway, logical_node_id, data, str(event_id), payload_hash
    )
    response.status_code = 201 if created else 200
    return ReadingCreateResponse.model_validate(reading)


# ---------- GET /readings/latest (must be before /{id}) ----------


@router.get("/latest", response_model=ReadingResponse | None)
def get_latest_reading(
    irrigation_area_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    validate_area_access(current_user, db, irrigation_area_id)
    reading = reading_service.get_latest_reading(db, irrigation_area_id)
    if reading is None:
        return None
    return ReadingResponse.from_reading(reading)


@router.get("/priority-status", response_model=PriorityStatusResponse)
def get_priority_status(
    irrigation_area_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    validate_area_access(current_user, db, irrigation_area_id)
    payload = reading_service.get_priority_status(
        db=db,
        irrigation_area_id=irrigation_area_id,
    )
    return PriorityStatusResponse.model_validate(payload)


@router.get("/availability", response_model=ReadingAvailabilityResponse)
def get_readings_availability(
    irrigation_area_id: int = Query(...),
    month_start: date | None = Query(
        None, description="Any date inside the target month (YYYY-MM-DD)"
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    validate_area_access(current_user, db, irrigation_area_id)
    min_date, max_date, available_dates = reading_service.get_readings_availability(
        db=db,
        irrigation_area_id=irrigation_area_id,
        month_start=month_start,
    )
    return ReadingAvailabilityResponse(
        min_date=min_date,
        max_date=max_date,
        available_dates=available_dates,
    )


# ---------- GET /readings/export ----------


@router.get("/export")
def export_readings(
    format: str = Query(..., pattern=r"^(csv|xlsx|pdf)$"),
    irrigation_area_id: int = Query(...),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    crop_cycle_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    validate_area_access(current_user, db, irrigation_area_id)

    if format == "csv":
        content = reading_service.export_readings_csv(
            db, irrigation_area_id, start_date, end_date, crop_cycle_id
        )
        return Response(
            content=content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=readings_{irrigation_area_id}.csv"
            },
        )
    elif format == "xlsx":
        content = reading_service.export_readings_xlsx(
            db, irrigation_area_id, start_date, end_date, crop_cycle_id
        )
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=readings_{irrigation_area_id}.xlsx"
            },
        )
    else:  # pdf
        content = reading_service.export_readings_pdf(
            db, irrigation_area_id, start_date, end_date, crop_cycle_id
        )
        return Response(
            content=content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=readings_{irrigation_area_id}.pdf"
            },
        )


# ---------- GET /readings (history) ----------


@router.get("", response_model=PaginatedResponse[ReadingResponse])
def list_readings(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    irrigation_area_id: int | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    crop_cycle_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    node_ids: list[int] | None = None

    if irrigation_area_id is not None:
        validate_area_access(current_user, db, irrigation_area_id)
    elif current_user.rol != "admin":
        node_ids = _get_client_node_ids(current_user, db)
        if not node_ids:
            return PaginatedResponse(
                page=page,
                per_page=per_page,
                total=0,
                data=[],
            )

    items, total = reading_service.list_readings(
        db=db,
        page=page,
        per_page=per_page,
        irrigation_area_id=irrigation_area_id,
        node_ids=node_ids,
        start_date=start_date,
        end_date=end_date,
        crop_cycle_id=crop_cycle_id,
    )
    return PaginatedResponse(
        page=page,
        per_page=per_page,
        total=total,
        data=[ReadingResponse.from_reading(r) for r in items],
    )
