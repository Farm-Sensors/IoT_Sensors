"""Integration tests for the machine pairing routes (start / token)."""

import logging

import pytest

from app.api.v1.endpoints import gateway_pairing as pairing_api
from app.core.config import settings
from app.models import PairingSession
from sqlalchemy import select

from tests.integration.test_gateway_lifecycle_api import _gateway


@pytest.fixture(autouse=True)
def _enable_pairing(monkeypatch):
    monkeypatch.setattr(settings, "GATEWAY_PAIRING_ENABLED", True)
    monkeypatch.setattr(settings, "PAIRING_VERIFICATION_BASE_URL", "https://cloud.example")
    pairing_api.reset_pairing_rate_limits()
    yield
    pairing_api.reset_pairing_rate_limits()


def _start(client, device=None):
    body = {"device": device} if device is not None else {}
    return client.post("/api/v1/gateways/pairing-sessions", json=body)


def _poll(client, device_code):
    return client.post("/api/v1/gateways/pairing-sessions/token", json={"device_code": device_code})


def _approve(client, admin_headers, session_id, user_code, gateway_id, **extra):
    body = {"user_code": user_code, "gateway_id": gateway_id, "confirm": True}
    body.update(extra)
    return client.post(
        f"/api/v1/gateways/pairing-sessions/{session_id}/approve",
        json=body,
        headers=admin_headers,
    )


def test_start_returns_protocol_fields_and_secrets_are_hashed(client, db):
    response = _start(client, {"hostname": "pi5", "model": "rpi", "agent_version": "2.0"})
    assert response.status_code == 201
    body = response.json()
    assert set(body) == {
        "device_code",
        "user_code",
        "verification_uri",
        "verification_uri_complete",
        "expires_in",
        "interval",
    }
    assert body["user_code"][4] == "-"
    assert body["verification_uri"] == "https://cloud.example/pair"
    assert body["verification_uri_complete"].endswith(f"code={body['user_code']}")
    assert body["expires_in"] == settings.PAIRING_TTL_SECONDS
    assert body["interval"] == settings.PAIRING_INTERVAL_SECONDS

    session = db.scalar(select(PairingSession))
    assert session.codigo_dispositivo_hash != body["device_code"]
    assert body["device_code"] not in session.codigo_dispositivo_hash


def test_start_pending_approve_token_single_use(
    client, db, admin_headers, sample_property
):
    gateway = _gateway(db, sample_property)
    started = _start(client)
    assert started.status_code == 201
    device_code = started.json()["device_code"]
    user_code = started.json()["user_code"]

    pending = _poll(client, device_code)
    assert pending.status_code == 400
    assert pending.json()["code"] == "authorization_pending"

    session = db.scalar(select(PairingSession))
    approved = _approve(client, admin_headers, session.id_publico, user_code, gateway.id)
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    assert approved.json()["gateway_id"] == gateway.id
    assert approved.json()["property_id"] == sample_property.id

    token = _poll(client, device_code)
    assert token.status_code == 200
    payload = token.json()
    assert set(payload) == {"gateway_id", "property_id", "credential"}
    assert payload["gateway_id"] == gateway.id
    assert payload["credential"].startswith("gk_")

    db.refresh(gateway)
    assert gateway.estado == "active"

    retry = _poll(client, device_code)
    assert retry.status_code == 401
    assert retry.json()["code"] == "invalid_device_code"
    assert "credential" not in retry.text


def test_deny_ends_session_with_access_denied(client, db, admin_headers, sample_property):
    gateway = _gateway(db, sample_property)
    started = _start(client)
    device_code = started.json()["device_code"]
    user_code = started.json()["user_code"]
    session = db.scalar(select(PairingSession))

    denied = client.post(
        f"/api/v1/gateways/pairing-sessions/{session.id_publico}/deny",
        json={"user_code": user_code},
        headers=admin_headers,
    )
    assert denied.status_code == 200
    assert denied.json()["status"] == "denied"

    poll = _poll(client, device_code)
    assert poll.status_code == 400
    assert poll.json()["code"] == "access_denied"


def test_expired_session_returns_expired_token(client, db):
    from datetime import UTC, datetime, timedelta

    from app.services import gateway_pairing as pairing_service

    past = datetime.now(UTC).replace(tzinfo=None) - timedelta(seconds=700)
    _session_row, device_code, _user_code = pairing_service.create_session(db, now=past)

    poll = _poll(client, device_code)
    assert poll.status_code == 400
    assert poll.json()["code"] == "expired_token"


def test_unknown_device_code_is_401(client):
    response = _poll(client, "not-a-real-device-code")
    assert response.status_code == 401
    assert response.json()["code"] == "invalid_device_code"


def test_start_is_rate_limited_per_ip(client, monkeypatch):
    monkeypatch.setattr(pairing_api, "START_LIMIT_PER_IP", 2)
    assert _start(client).status_code == 201
    assert _start(client).status_code == 201
    blocked = _start(client)
    assert blocked.status_code == 429
    assert blocked.json()["code"] == "too_many_attempts"


def test_pending_session_cap_returns_429(client, monkeypatch):
    monkeypatch.setattr(pairing_api, "START_LIMIT_PER_IP", 100)
    monkeypatch.setattr(pairing_api, "MAX_PENDING_SESSIONS", 2)
    assert _start(client).status_code == 201
    assert _start(client).status_code == 201
    capped = _start(client)
    assert capped.status_code == 429
    assert capped.json()["code"] == "too_many_attempts"


def test_disabled_flag_returns_503_envelope(client, monkeypatch):
    monkeypatch.setattr(settings, "GATEWAY_PAIRING_ENABLED", False)
    response = _start(client)
    assert response.status_code == 503
    assert response.json() == {
        "code": "pairing_unavailable",
        "message": "Gateway pairing is disabled",
    }


def test_logs_never_contain_codes(client, db, admin_headers, sample_property, caplog):
    gateway = _gateway(db, sample_property)
    caplog.set_level(logging.INFO, logger="app.api.v1.endpoints.gateway_pairing")
    started = _start(client)
    device_code = started.json()["device_code"]
    user_code = started.json()["user_code"]
    session = db.scalar(select(PairingSession))
    _approve(client, admin_headers, session.id_publico, user_code, gateway.id)
    _poll(client, device_code)

    assert device_code not in caplog.text
    assert user_code not in caplog.text
    assert user_code.replace("-", "") not in caplog.text
    assert session.id_publico in caplog.text
