"""Gateway device-authorization pairing routes (machine + admin).

The machine routes (``include_in_schema=False``) implement the credential-free
start/poll pair from the v2 contract; the admin routes (visible in the schema)
back the phone verification page and always require an admin JWT.

Nothing here logs, stores, or echoes the raw ``device_code`` or ``user_code``:
logs carry the opaque ``session_id`` and the outcome only, and the machine
credential is returned exactly once on redemption.
"""

import logging
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require_admin
from app.db.session import get_db
from app.models import Gateway, PairingSession, User
from app.models.pairing_session import LIVE_STATES
from app.schemas.gateway_lifecycle import GatewayCredentialResponse
from app.schemas.gateway_pairing import (
    PairingApproveRequest,
    PairingApproveResponse,
    PairingDenyRequest,
    PairingDenyResponse,
    PairingLookupRequest,
    PairingLookupResponse,
    PairingStartRequest,
    PairingStartResponse,
    PairingTokenRequest,
)
from app.services import gateway_pairing as pairing_service

logger = logging.getLogger(__name__)

router = APIRouter()

# Abuse limits (per process; the same in-memory sliding window used by login).
START_WINDOW = timedelta(minutes=10)
START_LIMIT_PER_IP = 5
ADMIN_WINDOW = timedelta(minutes=15)
ADMIN_FAILURE_LIMIT = 10
MAX_PENDING_SESSIONS = 50

_start_attempts: dict[str, list[datetime]] = {}
_admin_failures: dict[str, list[datetime]] = {}


def reset_pairing_rate_limits() -> None:
    """Clear the in-memory pairing limits (used by the test suite)."""
    _start_attempts.clear()
    _admin_failures.clear()


# --- Error envelopes --------------------------------------------------------


def _envelope(exc: HTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, dict) else {
        "code": "pairing_error",
        "message": str(exc.detail),
    }
    return JSONResponse(status_code=exc.status_code, content=detail, headers=exc.headers)


def _pairing_disabled() -> HTTPException:
    return HTTPException(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        {"code": "pairing_unavailable", "message": "Gateway pairing is disabled"},
    )


def _not_found() -> HTTPException:
    return HTTPException(
        status.HTTP_404_NOT_FOUND,
        {"code": "pairing_not_found", "message": "Pairing session not found"},
    )


def _too_many(message: str) -> HTTPException:
    return HTTPException(
        status.HTTP_429_TOO_MANY_REQUESTS, {"code": "too_many_attempts", "message": message}
    )


def _ensure_pairing_enabled() -> None:
    if not settings.GATEWAY_PAIRING_ENABLED:
        raise _pairing_disabled()


# --- Rate limiting ----------------------------------------------------------


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _prune(bucket: dict[str, list[datetime]], key: str, window: timedelta, now: datetime) -> list[datetime]:
    cutoff = now - window
    hits = [stamp for stamp in bucket.get(key, []) if stamp > cutoff]
    if hits:
        bucket[key] = hits
    else:
        bucket.pop(key, None)
    return hits


def _record(bucket: dict[str, list[datetime]], key: str, now: datetime) -> None:
    bucket.setdefault(key, []).append(now)


def _admin_keys(admin_id: int, ip: str) -> tuple[str, str]:
    return f"user:{admin_id}", f"ip:{ip}"


def _enforce_admin_limit(admin_id: int, ip: str, now: datetime) -> None:
    for key in _admin_keys(admin_id, ip):
        if len(_prune(_admin_failures, key, ADMIN_WINDOW, now)) >= ADMIN_FAILURE_LIMIT:
            raise _too_many("Too many failed pairing attempts; try again later")


def _record_admin_failure(admin_id: int, ip: str, now: datetime) -> None:
    for key in _admin_keys(admin_id, ip):
        _record(_admin_failures, key, now)


def _live_session_count(db: Session) -> int:
    return db.execute(
        select(func.count())
        .select_from(PairingSession)
        .where(PairingSession.estado.in_(LIVE_STATES))
    ).scalar_one()


# --- Machine operations -----------------------------------------------------


@router.post(
    "/pairing-sessions",
    response_model=PairingStartResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def start_pairing_session(
    payload: PairingStartRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    now = datetime.now(UTC)
    ip = _client_ip(request)
    try:
        _ensure_pairing_enabled()
        if len(_prune(_start_attempts, ip, START_WINDOW, now)) >= START_LIMIT_PER_IP:
            raise _too_many("Too many pairing sessions started from this network")
        _record(_start_attempts, ip, now)
        if _live_session_count(db) >= MAX_PENDING_SESSIONS:
            raise _too_many("Pairing capacity reached; try again later")
        device = payload.device.model_dump() if payload.device is not None else None
        session, device_code, user_code = pairing_service.create_session(
            db, device=device, source_ip=ip
        )
    except HTTPException as exc:
        return _envelope(exc)

    base = settings.PAIRING_VERIFICATION_BASE_URL.rstrip("/")
    verification_uri = f"{base}/pair"
    display_code = pairing_service.format_user_code(user_code)
    logger.info("pairing session %s started", session.id_publico)
    return PairingStartResponse(
        device_code=device_code,
        user_code=display_code,
        verification_uri=verification_uri,
        verification_uri_complete=f"{verification_uri}?code={display_code}",
        expires_in=settings.PAIRING_TTL_SECONDS,
        interval=session.intervalo_s,
    )


@router.post(
    "/pairing-sessions/token",
    response_model=GatewayCredentialResponse,
    include_in_schema=False,
)
def poll_pairing_token(
    payload: PairingTokenRequest,
    db: Session = Depends(get_db),
):
    try:
        _ensure_pairing_enabled()
        gateway, credential = pairing_service.redeem(db, payload.device_code)
    except HTTPException as exc:
        code = exc.detail.get("code") if isinstance(exc.detail, dict) else exc.status_code
        logger.info("pairing token poll rejected: %s", code)
        return _envelope(exc)
    logger.info("pairing session consumed for gateway %s", gateway.id)
    return GatewayCredentialResponse(
        gateway_id=gateway.id, property_id=gateway.predio_id, credential=credential
    )


# --- Admin operations -------------------------------------------------------


@router.post("/pairing-sessions/lookup", response_model=PairingLookupResponse)
def lookup_pairing_session(
    payload: PairingLookupRequest,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    now = datetime.now(UTC)
    ip = _client_ip(request)
    try:
        _ensure_pairing_enabled()
        _enforce_admin_limit(admin.id, ip, now)
        session = pairing_service.find_by_user_code(db, payload.user_code)
        if session is None:
            _record_admin_failure(admin.id, ip, now)
            raise _not_found()
    except HTTPException as exc:
        return _envelope(exc)

    logger.info("pairing session %s looked up", session.id_publico)
    return PairingLookupResponse(
        session_id=session.id_publico,
        user_code=pairing_service.format_user_code(payload.user_code),
        status=session.estado,
        requested_at=session.creado_en,
        expires_at=session.expira_en,
        device={
            "hostname": session.dispositivo_hostname,
            "model": session.dispositivo_modelo,
            "agent_version": session.dispositivo_version,
        },
        source_network=session.red_origen,
    )


@router.post("/pairing-sessions/{session_id}/approve", response_model=PairingApproveResponse)
def approve_pairing_session(
    session_id: str,
    payload: PairingApproveRequest,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    now = datetime.now(UTC)
    ip = _client_ip(request)
    try:
        _ensure_pairing_enabled()
        _enforce_admin_limit(admin.id, ip, now)
        if not payload.confirm:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                {"code": "confirmation_required", "message": "Confirmation is required"},
            )
        session = pairing_service.approve_session(
            db,
            session_id=session_id,
            user_code=payload.user_code,
            gateway_id=payload.gateway_id,
            replace_credential=payload.replace_credential,
            approved_by=admin.id,
        )
        gateway = db.get(Gateway, session.pasarela_id)
        property_id = gateway.predio_id if gateway is not None else 0
    except HTTPException as exc:
        if exc.status_code == status.HTTP_404_NOT_FOUND:
            _record_admin_failure(admin.id, ip, now)
        return _envelope(exc)

    logger.info("pairing session %s approved for gateway %s", session.id_publico, payload.gateway_id)
    return PairingApproveResponse(
        session_id=session.id_publico,
        status=session.estado,
        gateway_id=session.pasarela_id or payload.gateway_id,
        property_id=property_id,
    )


@router.post("/pairing-sessions/{session_id}/deny", response_model=PairingDenyResponse)
def deny_pairing_session(
    session_id: str,
    payload: PairingDenyRequest,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    now = datetime.now(UTC)
    ip = _client_ip(request)
    try:
        _ensure_pairing_enabled()
        _enforce_admin_limit(admin.id, ip, now)
        session = pairing_service.deny_session(
            db,
            session_id=session_id,
            user_code=payload.user_code,
            resolved_by=admin.id,
        )
    except HTTPException as exc:
        if exc.status_code == status.HTTP_404_NOT_FOUND:
            _record_admin_failure(admin.id, ip, now)
        return _envelope(exc)

    logger.info("pairing session %s denied", session.id_publico)
    return PairingDenyResponse(session_id=session.id_publico, status=session.estado)
