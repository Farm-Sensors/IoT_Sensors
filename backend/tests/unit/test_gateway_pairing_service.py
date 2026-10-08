"""Unit tests for the gateway pairing service."""

import hashlib
import hmac as hmaclib
from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.core.config import settings
from app.models import ActivationReference, Gateway, GatewaySlot
from app.services import gateway_pairing as pairing

CREATED = datetime(2026, 10, 7, 12, 0, 0)


def _sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _pending_gateway(db, prop) -> Gateway:
    gateway = Gateway(predio_id=prop.id, estado="pending_activation")
    db.add(gateway)
    db.commit()
    db.refresh(gateway)
    return gateway


def _error(exc_info) -> dict:
    return exc_info.value.detail


# --- Codes ------------------------------------------------------------------


def test_user_code_alphabet_and_length():
    assert "0" not in pairing.USER_CODE_ALPHABET
    assert "O" not in pairing.USER_CODE_ALPHABET
    assert "1" not in pairing.USER_CODE_ALPHABET
    assert "I" not in pairing.USER_CODE_ALPHABET
    assert not (set("AEIOU") & set(pairing.USER_CODE_ALPHABET))
    for _ in range(200):
        code = pairing.generate_user_code()
        assert len(code) == pairing.USER_CODE_LENGTH
        assert set(code) <= set(pairing.USER_CODE_ALPHABET)


def test_normalize_and_format_user_code():
    raw = pairing.generate_user_code()
    display = pairing.format_user_code(raw)
    assert display == f"{raw[:4]}-{raw[4:]}"
    assert pairing.normalize_user_code(display) == raw
    assert pairing.normalize_user_code(f"  {raw.lower()}  ") == raw
    assert pairing.normalize_user_code(f"{raw[:4]} - {raw[4:]}") == raw

    with pytest.raises(ValueError):
        pairing.normalize_user_code("ABC")
    with pytest.raises(ValueError):
        pairing.normalize_user_code("AEIOUAEI")
    with pytest.raises(ValueError):
        pairing.normalize_user_code(12345)


def test_hmac_is_keyed_case_insensitive_and_stable():
    code = "BCDFGHJK"
    expected = hmaclib.new(
        settings.SECRET_KEY.encode("utf-8"), code.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    assert pairing.hmac_user_code(code) == expected
    assert pairing.hmac_user_code("bcdf-ghjk") == expected
    assert pairing.hmac_user_code("BCDFGHJL") != expected


def test_coarse_network_prefixes():
    assert pairing.coarse_network("10.32.90.229") == "10.32.90.0/24"
    assert pairing.coarse_network("2001:db8::1") == "2001:db8::/48"
    assert pairing.coarse_network("not-an-ip") is None
    assert pairing.coarse_network(None) is None


# --- Session creation and lookup --------------------------------------------


def test_create_session_persists_hashes_not_secrets(db, sample_property):
    session, device_code, user_code = pairing.create_session(
        db,
        device={"hostname": "pi5", "model": "raspberry", "agent_version": "1.2.3"},
        source_ip="10.32.90.229",
    )
    assert session.estado == "pending"
    assert len(session.id_publico) == 26
    assert session.codigo_dispositivo_hash == _sha(device_code)
    assert session.codigo_usuario_hmac == pairing.hmac_user_code(user_code)
    assert session.codigo_usuario_vivo == session.codigo_usuario_hmac
    assert session.expira_en - session.creado_en == timedelta(
        seconds=settings.PAIRING_TTL_SECONDS
    )
    assert session.intervalo_s == settings.PAIRING_INTERVAL_SECONDS
    assert session.dispositivo_hostname == "pi5"
    assert session.dispositivo_modelo == "raspberry"
    assert session.dispositivo_version == "1.2.3"
    assert session.red_origen == "10.32.90.0/24"
    assert device_code not in session.codigo_dispositivo_hash


def test_find_by_user_code_normalizes_and_is_uniform(db):
    session, _device_code, user_code = pairing.create_session(db)
    found = pairing.find_by_user_code(db, pairing.format_user_code(user_code.lower()))
    assert found is not None and found.id == session.id
    assert pairing.find_by_user_code(db, "BCDF-GHJK") is None
    assert pairing.find_by_user_code(db, "not valid") is None


# --- Activation path --------------------------------------------------------


def test_activation_flow_consumes_once_and_issues_credential(
    db, sample_property, admin_user
):
    gateway = _pending_gateway(db, sample_property)
    session, device_code, user_code = pairing.create_session(db)

    with pytest.raises(HTTPException) as pending_exc:
        pairing.redeem(db, device_code)
    assert pending_exc.value.status_code == 400
    assert _error(pending_exc)["code"] == "authorization_pending"

    approved = pairing.approve_session(
        db,
        session_id=session.id_publico,
        user_code=user_code,
        gateway_id=gateway.id,
        approved_by=admin_user.id,
        now=CREATED,
    )
    assert approved.estado == "approved"
    assert approved.proposito == "activation"
    assert approved.pasarela_id == gateway.id

    redeemed_gateway, credential = pairing.redeem(db, device_code, now=CREATED)
    assert credential.startswith("gk_")
    assert redeemed_gateway.id == gateway.id
    assert redeemed_gateway.estado == "active"
    assert redeemed_gateway.credencial_hash == _sha(credential)

    db.refresh(session)
    assert session.estado == "consumed"
    assert session.consumido_en is not None

    with pytest.raises(HTTPException) as reused:
        pairing.redeem(db, device_code)
    assert reused.value.status_code == 401
    assert _error(reused)["code"] == "invalid_device_code"


def test_activation_revokes_outstanding_references(db, sample_property, admin_user):
    gateway = _pending_gateway(db, sample_property)
    reference = ActivationReference(
        pasarela_id=gateway.id,
        referencia_hash=_sha("outstanding-reference"),
        emitido_por_usuario_id=admin_user.id,
        creado_en=CREATED,
        expira_en=CREATED + timedelta(hours=24),
        resultado="issued",
    )
    db.add(reference)
    db.commit()

    session, device_code, user_code = pairing.create_session(db, now=CREATED)
    pairing.approve_session(
        db,
        session_id=session.id_publico,
        user_code=user_code,
        gateway_id=gateway.id,
        now=CREATED,
    )
    pairing.redeem(db, device_code, now=CREATED)
    db.refresh(reference)
    assert reference.resultado == "revoked"
    assert reference.invalidado_en == CREATED


def test_redeem_denied_gateway_unavailable(db, sample_property):
    gateway = _pending_gateway(db, sample_property)
    session, device_code, user_code = pairing.create_session(db)
    pairing.approve_session(
        db, session_id=session.id_publico, user_code=user_code, gateway_id=gateway.id
    )

    gateway.estado = "active"
    gateway.credencial_hash = _sha("other-credential")
    gateway.credencial_prefijo = "gk_other"
    db.commit()

    with pytest.raises(HTTPException) as exc:
        pairing.redeem(db, device_code)
    assert _error(exc)["code"] == "access_denied"
    db.refresh(session)
    assert session.estado == "denied"
    assert session.motivo == "gateway_unavailable"


# --- Expiry, denial and slow_down -------------------------------------------


def test_lazy_expiry_ends_session_and_token(db):
    session, device_code, _user_code = pairing.create_session(db, now=CREATED)
    with pytest.raises(HTTPException) as exc:
        pairing.redeem(db, device_code, now=CREATED + timedelta(seconds=601))
    assert exc.value.status_code == 400
    assert _error(exc)["code"] == "expired_token"
    db.refresh(session)
    assert session.estado == "expired"
    assert session.resuelto_en == CREATED + timedelta(seconds=601)


def test_deny_transition_and_access_denied(db):
    session, device_code, user_code = pairing.create_session(db)
    denied = pairing.deny_session(db, session_id=session.id_publico, user_code=user_code)
    assert denied.estado == "denied"
    assert denied.motivo == "denied_by_admin"
    with pytest.raises(HTTPException) as exc:
        pairing.redeem(db, device_code)
    assert _error(exc)["code"] == "access_denied"


def test_wrong_user_code_is_counted_and_denies_session(db, sample_property):
    gateway = _pending_gateway(db, sample_property)
    session, _device_code, _user_code = pairing.create_session(db)

    for expected in range(1, settings.PAIRING_MAX_WRONG_CODE_ATTEMPTS):
        with pytest.raises(HTTPException) as exc:
            pairing.approve_session(
                db,
                session_id=session.id_publico,
                user_code="BCDFGHJL",
                gateway_id=gateway.id,
            )
        assert exc.value.status_code == 404
        db.refresh(session)
        assert session.intentos_codigo_fallidos == expected

    with pytest.raises(HTTPException):
        pairing.approve_session(
            db, session_id=session.id_publico, user_code="BCDFGHJL", gateway_id=gateway.id
        )
    db.refresh(session)
    assert session.estado == "denied"


def test_slow_down_increases_interval_and_then_redeems(db, sample_property):
    gateway = _pending_gateway(db, sample_property)
    session, device_code, user_code = pairing.create_session(db, now=CREATED)
    pairing.approve_session(
        db,
        session_id=session.id_publico,
        user_code=user_code,
        gateway_id=gateway.id,
        now=CREATED,
    )

    session.ultimo_sondeo_en = CREATED
    db.commit()

    with pytest.raises(HTTPException) as exc:
        pairing.redeem(db, device_code, now=CREATED + timedelta(seconds=1))
    assert _error(exc)["code"] == "slow_down"
    assert _error(exc)["interval"] == 10
    db.refresh(session)
    assert session.intervalo_s == 10

    redeemed_gateway, credential = pairing.redeem(
        db, device_code, now=CREATED + timedelta(seconds=11)
    )
    assert redeemed_gateway.estado == "active"
    assert credential.startswith("gk_")


# --- Re-pair with credential rotation (decision 7) --------------------------


def test_active_gateway_requires_replace_credential(db, sample_gateway):
    gateway, _credential = sample_gateway
    session, _device_code, user_code = pairing.create_session(db)
    with pytest.raises(HTTPException) as exc:
        pairing.approve_session(
            db, session_id=session.id_publico, user_code=user_code, gateway_id=gateway.id
        )
    assert exc.value.status_code == 409
    assert _error(exc)["code"] == "credential_replacement_required"


def test_pending_gateway_rejects_replace_credential(db, sample_property):
    gateway = _pending_gateway(db, sample_property)
    session, _device_code, user_code = pairing.create_session(db)
    with pytest.raises(HTTPException) as exc:
        pairing.approve_session(
            db,
            session_id=session.id_publico,
            user_code=user_code,
            gateway_id=gateway.id,
            replace_credential=True,
        )
    assert exc.value.status_code == 409
    assert _error(exc)["code"] == "unexpected_credential_replacement"


def test_rotation_replaces_credential_and_keeps_bindings(db, sample_gateway):
    gateway, old_credential = sample_gateway
    old_hash = gateway.credencial_hash
    slots_before = list(
        db.scalars(select(GatewaySlot).where(GatewaySlot.pasarela_id == gateway.id))
    )
    assert slots_before

    session, device_code, user_code = pairing.create_session(db)
    approved = pairing.approve_session(
        db,
        session_id=session.id_publico,
        user_code=user_code,
        gateway_id=gateway.id,
        replace_credential=True,
    )
    assert approved.proposito == "rotation"

    redeemed_gateway, credential = pairing.redeem(db, device_code)
    assert redeemed_gateway.id == gateway.id
    assert redeemed_gateway.estado == "active"
    assert credential.startswith("gk_")
    assert gateway.credencial_hash == _sha(credential)
    assert gateway.credencial_hash != old_hash
    assert gateway.credencial_hash != _sha(old_credential)

    slots_after = list(
        db.scalars(select(GatewaySlot).where(GatewaySlot.pasarela_id == gateway.id))
    )
    assert [slot.id for slot in slots_after] == [slot.id for slot in slots_before]
