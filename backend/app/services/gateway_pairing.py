"""Gateway device-authorization pairing (RFC 8628 style).

Complements the single-use ``ar_`` activation reference with a short on-screen
``user_code`` that an administrator approves from a signed-in session. The raw
``device_code`` and ``user_code`` never leave this module; the credential issued
on redemption is the same ``gk_`` credential activation returns, produced by the
shared :func:`app.services.gateway_lifecycle._activate_gateway` helper.

Error bodies follow the RFC 8628 names inside ``{"code", "message"}`` envelopes,
matching the v2 contract error shape.
"""

import hashlib
import hmac
import ipaddress
import secrets
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import ActivationReference, Gateway, PairingSession
from app.models.pairing_session import LIVE_STATES
from app.services.gateway_lifecycle import _CredentialTransitionFailed, _activate_gateway

USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ"
USER_CODE_LENGTH = 8
DEVICE_FIELD_MAX = 64


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


# --- Code generation and normalization -------------------------------------


def generate_user_code() -> str:
    """Return 8 consonants from the RFC 8628 set (no vowels, no 0/O/1/I)."""
    return "".join(secrets.choice(USER_CODE_ALPHABET) for _ in range(USER_CODE_LENGTH))


def normalize_user_code(value: str) -> str:
    """Uppercase and strip the display hyphen/spaces; validate the alphabet."""
    if not isinstance(value, str):
        raise ValueError("El código de usuario debe ser texto")
    normalized = value.strip().upper().replace("-", "").replace(" ", "")
    if len(normalized) != USER_CODE_LENGTH:
        raise ValueError("El código de usuario debe tener 8 caracteres")
    if any(char not in USER_CODE_ALPHABET for char in normalized):
        raise ValueError("El código de usuario contiene caracteres no válidos")
    return normalized


def format_user_code(value: str) -> str:
    """Render a normalized code as ``XXXX-XXXX`` for display."""
    normalized = normalize_user_code(value)
    return f"{normalized[:4]}-{normalized[4:]}"


def hash_device_code(device_code: str) -> str:
    return hashlib.sha256(device_code.encode("utf-8")).hexdigest()


def _hmac_key() -> bytes:
    return (settings.PAIRING_CODE_HMAC_KEY or settings.SECRET_KEY).encode("utf-8")


def hmac_user_code(user_code: str) -> str:
    """HMAC-SHA256 of the normalized user code, keyed by the server secret."""
    normalized = normalize_user_code(user_code)
    return hmac.new(_hmac_key(), normalized.encode("utf-8"), hashlib.sha256).hexdigest()


def coarse_network(source_ip: str | None) -> str | None:
    """Coarse source prefix kept for display only: IPv4 /24, IPv6 /48."""
    if not source_ip:
        return None
    try:
        address = ipaddress.ip_address(source_ip)
    except ValueError:
        return None
    prefix = 24 if address.version == 4 else 48
    return str(ipaddress.ip_network(f"{address}/{prefix}", strict=False))


def _bounded(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text[:DEVICE_FIELD_MAX]


# --- HTTP error envelopes ---------------------------------------------------


def _error(status_code: int, code: str, message: str, **extra) -> HTTPException:
    detail = {"code": code, "message": message}
    detail.update(extra)
    return HTTPException(status_code=status_code, detail=detail)


def _not_found() -> HTTPException:
    return _error(status.HTTP_404_NOT_FOUND, "pairing_not_found", "Pairing session not found")


def _invalid_device_code() -> HTTPException:
    return _error(
        status.HTTP_401_UNAUTHORIZED,
        "invalid_device_code",
        "Invalid or already used device code",
    )


def _authorization_pending() -> HTTPException:
    return _error(
        status.HTTP_400_BAD_REQUEST, "authorization_pending", "The pairing is not approved yet"
    )


def _expired_token() -> HTTPException:
    return _error(status.HTTP_400_BAD_REQUEST, "expired_token", "The pairing session expired")


def _access_denied() -> HTTPException:
    return _error(status.HTTP_400_BAD_REQUEST, "access_denied", "The pairing was not approved")


def _slow_down(interval: int) -> HTTPException:
    return _error(
        status.HTTP_400_BAD_REQUEST,
        "slow_down",
        "Poll slower than the current interval",
        interval=interval,
    )


# --- Session lifecycle ------------------------------------------------------


def _live_hmac_exists(db: Session, value: str) -> bool:
    return (
        db.execute(
            select(PairingSession.id).where(
                PairingSession.codigo_usuario_vivo == value,
            )
        ).first()
        is not None
    )


def _coerce_now(now: datetime | None) -> datetime:
    return now if now is not None else _now()


def _expire_if_needed(db: Session, session: PairingSession, now: datetime) -> bool:
    """Lazily move a live session past its TTL to ``expired``."""
    if session.estado not in LIVE_STATES or session.expira_en > now:
        return False
    changed = db.execute(
        update(PairingSession)
        .where(PairingSession.id == session.id, PairingSession.estado.in_(LIVE_STATES))
        .values(estado="expired", resuelto_en=now)
    )
    db.commit()
    db.refresh(session)
    return bool(changed.rowcount)


def _bump_wrong_code(db: Session, session: PairingSession, now: datetime) -> None:
    db.execute(
        update(PairingSession)
        .where(PairingSession.id == session.id)
        .values(intentos_codigo_fallidos=PairingSession.intentos_codigo_fallidos + 1)
    )
    db.commit()
    db.refresh(session)
    if session.intentos_codigo_fallidos >= settings.PAIRING_MAX_WRONG_CODE_ATTEMPTS:
        db.execute(
            update(PairingSession)
            .where(PairingSession.id == session.id, PairingSession.estado.in_(LIVE_STATES))
            .values(estado="denied", motivo="denied_by_admin", resuelto_en=now)
        )
        db.commit()
        db.refresh(session)


def _matches_user_code(session: PairingSession, user_code: str) -> bool:
    try:
        candidate = hmac_user_code(user_code)
    except ValueError:
        return False
    return hmac.compare_digest(candidate, session.codigo_usuario_hmac)


def create_session(
    db: Session,
    *,
    device: Mapping[str, object] | None = None,
    source_ip: str | None = None,
    now: datetime | None = None,
) -> tuple[PairingSession, str, str]:
    """Create a pending session; returns ``(session, device_code, user_code)``."""
    now = _coerce_now(now)
    device = device or {}
    device_code = secrets.token_urlsafe(32)
    user_code = generate_user_code()
    for _ in range(50):
        hmac_value = hmac_user_code(user_code)
        if not _live_hmac_exists(db, hmac_value):
            break
        user_code = generate_user_code()
    else:  # pragma: no cover - astronomically unlikely
        raise RuntimeError("No se pudo asignar un código de usuario único")

    session = PairingSession(
        id_publico=secrets.token_hex(13),
        codigo_dispositivo_hash=hash_device_code(device_code),
        codigo_usuario_hmac=hmac_value,
        estado="pending",
        creado_en=now,
        expira_en=now + timedelta(seconds=settings.PAIRING_TTL_SECONDS),
        intervalo_s=settings.PAIRING_INTERVAL_SECONDS,
        dispositivo_hostname=_bounded(device.get("hostname")),
        dispositivo_modelo=_bounded(device.get("model")),
        dispositivo_version=_bounded(device.get("agent_version")),
        red_origen=coarse_network(source_ip),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session, device_code, user_code


def find_by_user_code(
    db: Session, user_code: str, *, now: datetime | None = None
) -> PairingSession | None:
    """Return the live session for a displayed code, or ``None`` (uniform)."""
    try:
        hmac_value = hmac_user_code(user_code)
    except ValueError:
        return None
    session = db.execute(
        select(PairingSession).where(PairingSession.codigo_usuario_vivo == hmac_value)
    ).scalar_one_or_none()
    if session is None:
        return None
    _expire_if_needed(db, session, _coerce_now(now))
    if session.estado not in LIVE_STATES:
        return None
    return session


def approve_session(
    db: Session,
    *,
    session_id: str,
    user_code: str,
    gateway_id: int,
    replace_credential: bool = False,
    approved_by: int | None = None,
    now: datetime | None = None,
) -> PairingSession:
    """Guarded pending -> approved transition, binding a gateway to the session."""
    now = _coerce_now(now)
    session = db.execute(
        select(PairingSession)
        .where(PairingSession.id_publico == session_id)
        .with_for_update()
    ).scalar_one_or_none()
    if session is None:
        raise _not_found()
    if _expire_if_needed(db, session, now):
        raise _not_found()
    if session.estado != "pending":
        raise _error(
            status.HTTP_409_CONFLICT,
            "pairing_session_not_pending",
            "The pairing session is no longer pending",
        )
    if not _matches_user_code(session, user_code):
        _bump_wrong_code(db, session, now)
        raise _not_found()

    gateway = db.execute(
        select(Gateway)
        .where(Gateway.id == gateway_id, Gateway.eliminado_en.is_(None))
        .with_for_update()
    ).scalar_one_or_none()
    if gateway is None:
        raise _error(status.HTTP_404_NOT_FOUND, "gateway_not_found", "Gateway not found")

    if gateway.estado == "pending_activation":
        if replace_credential:
            raise _error(
                status.HTTP_409_CONFLICT,
                "unexpected_credential_replacement",
                "A pending gateway does not need credential replacement",
            )
        purpose = "activation"
    elif gateway.estado == "active":
        if not replace_credential:
            raise _error(
                status.HTTP_409_CONFLICT,
                "credential_replacement_required",
                "Approving an active gateway requires replace_credential",
            )
        purpose = "rotation"
    else:
        raise _error(
            status.HTTP_409_CONFLICT,
            "gateway_not_pairable",
            "Gateway is not awaiting activation or active",
        )

    changed = db.execute(
        update(PairingSession)
        .where(PairingSession.id == session.id, PairingSession.estado == "pending")
        .values(
            estado="approved",
            proposito=purpose,
            pasarela_id=gateway.id,
            aprobado_por_usuario_id=approved_by,
            aprobado_en=now,
        )
    )
    if changed.rowcount != 1:
        db.rollback()
        raise _error(
            status.HTTP_409_CONFLICT,
            "pairing_session_not_pending",
            "The pairing session is no longer pending",
        )
    db.commit()
    db.refresh(session)
    return session


def deny_session(
    db: Session,
    *,
    session_id: str,
    user_code: str,
    reason: str = "denied_by_admin",
    resolved_by: int | None = None,
    now: datetime | None = None,
) -> PairingSession:
    """Guarded ``pending|approved -> denied`` transition."""
    now = _coerce_now(now)
    session = db.execute(
        select(PairingSession)
        .where(PairingSession.id_publico == session_id)
        .with_for_update()
    ).scalar_one_or_none()
    if session is None:
        raise _not_found()
    if _expire_if_needed(db, session, now):
        raise _not_found()
    if session.estado not in LIVE_STATES:
        raise _error(
            status.HTTP_409_CONFLICT,
            "pairing_session_not_pending",
            "The pairing session is no longer pending",
        )
    if not _matches_user_code(session, user_code):
        _bump_wrong_code(db, session, now)
        raise _not_found()

    changed = db.execute(
        update(PairingSession)
        .where(PairingSession.id == session.id, PairingSession.estado.in_(LIVE_STATES))
        .values(
            estado="denied",
            motivo=reason,
            aprobado_por_usuario_id=resolved_by,
            resuelto_en=now,
        )
    )
    if changed.rowcount != 1:
        db.rollback()
        raise _error(
            status.HTTP_409_CONFLICT,
            "pairing_session_not_pending",
            "The pairing session is no longer pending",
        )
    db.commit()
    db.refresh(session)
    return session


def redeem(
    db: Session, device_code: str, *, now: datetime | None = None
) -> tuple[Gateway, str]:
    """Consume an approved session and return ``(gateway, credential)`` once.

    ``activation`` moves a ``pending_activation`` gateway to ``active`` and revokes
    outstanding ``ar_`` references; ``rotation`` replaces the credential of an
    ``active`` gateway while keeping its row, slots and bindings.
    """
    now = _coerce_now(now)
    session = db.execute(
        select(PairingSession)
        .where(PairingSession.codigo_dispositivo_hash == hash_device_code(device_code))
        .with_for_update()
    ).scalar_one_or_none()
    if session is None or session.estado == "consumed":
        raise _invalid_device_code()
    if _expire_if_needed(db, session, now):
        raise _expired_token()
    if session.estado == "expired":
        raise _expired_token()
    if session.estado == "denied":
        raise _access_denied()
    if session.estado == "pending":
        raise _authorization_pending()

    # estado == "approved"
    if (
        session.ultimo_sondeo_en is not None
        and (now - session.ultimo_sondeo_en).total_seconds() < session.intervalo_s
    ):
        interval = min(
            session.intervalo_s + settings.PAIRING_SLOW_DOWN_SECONDS,
            settings.PAIRING_MAX_INTERVAL_SECONDS,
        )
        db.execute(
            update(PairingSession)
            .where(PairingSession.id == session.id, PairingSession.estado == "approved")
            .values(intervalo_s=interval, ultimo_sondeo_en=now)
        )
        db.commit()
        raise _slow_down(interval)

    db.execute(
        update(PairingSession)
        .where(PairingSession.id == session.id, PairingSession.estado == "approved")
        .values(ultimo_sondeo_en=now)
    )

    gateway = db.execute(
        select(Gateway)
        .where(Gateway.id == session.pasarela_id, Gateway.eliminado_en.is_(None))
        .with_for_update()
    ).scalar_one_or_none()
    expected_state = "pending_activation" if session.proposito == "activation" else "active"
    if gateway is None or gateway.estado != expected_state:
        db.execute(
            update(PairingSession)
            .where(PairingSession.id == session.id, PairingSession.estado == "approved")
            .values(estado="denied", motivo="gateway_unavailable", resuelto_en=now)
        )
        db.commit()
        raise _access_denied()

    consumed = db.execute(
        update(PairingSession)
        .where(PairingSession.id == session.id, PairingSession.estado == "approved")
        .values(estado="consumed", consumido_en=now, resuelto_en=now)
    )
    if consumed.rowcount != 1:
        db.rollback()
        raise _invalid_device_code()

    replace = session.proposito == "rotation"
    try:
        credential = _activate_gateway(db, gateway_id=gateway.id, now=now, replace=replace)
    except _CredentialTransitionFailed:
        db.rollback()
        raise _access_denied()
    if not replace:
        db.execute(
            update(ActivationReference)
            .where(
                ActivationReference.pasarela_id == gateway.id,
                ActivationReference.resultado == "issued",
            )
            .values(resultado="revoked", invalidado_en=now)
        )
    db.commit()
    db.refresh(gateway)
    return gateway, credential
