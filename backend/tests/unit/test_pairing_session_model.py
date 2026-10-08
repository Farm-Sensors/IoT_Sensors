"""Unit tests for the ``sesiones_emparejamiento`` model."""

import hashlib
from datetime import datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import PairingSession

CREATED = datetime(2026, 10, 7, 12, 0, 0)


def _sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _session(**overrides) -> PairingSession:
    defaults = {
        "id_publico": "a" * 26,
        "codigo_dispositivo_hash": _sha("device-code"),
        "codigo_usuario_hmac": _sha("user-code"),
        "estado": "pending",
        "creado_en": CREATED,
        "expira_en": CREATED + timedelta(seconds=600),
        "intervalo_s": 5,
        "intentos_codigo_fallidos": 0,
    }
    defaults.update(overrides)
    return PairingSession(**defaults)


def _expect_integrity(db, session: PairingSession) -> None:
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            db.add(session)
            db.flush()


def test_live_code_generated_column_is_the_hmac_while_live(db):
    session = _session()
    db.add(session)
    db.commit()
    db.refresh(session)
    assert session.codigo_usuario_vivo == session.codigo_usuario_hmac

    session.estado = "denied"
    session.motivo = "denied_by_admin"
    session.resuelto_en = CREATED + timedelta(seconds=10)
    db.commit()
    db.refresh(session)
    assert session.codigo_usuario_vivo is None


def test_live_code_is_unique_only_for_pending_or_approved(db):
    shared_hmac = _sha("shared-code")
    db.add(_session(id_publico="b" * 26, codigo_usuario_hmac=shared_hmac))
    db.commit()

    _expect_integrity(
        db,
        _session(
            id_publico="c" * 26,
            codigo_dispositivo_hash=_sha("other-device"),
            codigo_usuario_hmac=shared_hmac,
        ),
    )

    # Terminal sessions may reuse a code: the live column is NULL.
    db.add(
        _session(
            id_publico="d" * 26,
            codigo_dispositivo_hash=_sha("terminal-device"),
            codigo_usuario_hmac=shared_hmac,
            estado="expired",
            resuelto_en=CREATED + timedelta(seconds=700),
        )
    )
    db.commit()


def test_hash_columns_reject_non_sha256():
    with pytest.raises(ValueError):
        _session(codigo_usuario_hmac="not-a-digest")
    with pytest.raises(ValueError):
        _session(id_publico="e" * 26, codigo_dispositivo_hash="zz")


def test_state_check_constraint_rejects_unknown_state(db):
    _expect_integrity(db, _session(estado="waiting"))


def test_expiry_check_constraint_requires_positive_window(db):
    _expect_integrity(db, _session(expira_en=CREATED))


def test_reason_and_purpose_check_constraints(db):
    _expect_integrity(db, _session(estado="denied", motivo="nope", resuelto_en=CREATED))
    _expect_integrity(
        db,
        _session(
            estado="denied", motivo="cancelled", proposito="guess", resuelto_en=CREATED
        ),
    )


def test_approved_session_requires_a_gateway(db):
    _expect_integrity(db, _session(estado="approved", proposito="activation"))
