"""Integration tests for the admin pairing routes (lookup / approve / deny)."""

import logging

import pytest
from sqlalchemy import select

from app.api.v1.endpoints import gateway_pairing as pairing_api
from app.core.config import settings
from app.models import PairingSession

from tests.integration.test_gateway_lifecycle_api import _gateway


@pytest.fixture(autouse=True)
def _enable_pairing(monkeypatch):
    monkeypatch.setattr(settings, "GATEWAY_PAIRING_ENABLED", True)
    monkeypatch.setattr(settings, "PAIRING_VERIFICATION_BASE_URL", "https://cloud.example")
    pairing_api.reset_pairing_rate_limits()
    yield
    pairing_api.reset_pairing_rate_limits()


def _start(client, device=None, headers=None):
    body = {"device": device} if device is not None else {}
    return client.post("/api/v1/gateways/pairing-sessions", json=body, headers=headers or {})


def _lookup(client, headers, user_code):
    return client.post(
        "/api/v1/gateways/pairing-sessions/lookup",
        json={"user_code": user_code},
        headers=headers,
    )


def _approve(client, headers, session_id, user_code, gateway_id, **extra):
    body = {"user_code": user_code, "gateway_id": gateway_id, "confirm": True}
    body.update(extra)
    return client.post(
        f"/api/v1/gateways/pairing-sessions/{session_id}/approve",
        json=body,
        headers=headers,
    )


def _deny(client, headers, session_id, user_code):
    return client.post(
        f"/api/v1/gateways/pairing-sessions/{session_id}/deny",
        json={"user_code": user_code},
        headers=headers,
    )


def _poll(client, device_code):
    return client.post(
        "/api/v1/gateways/pairing-sessions/token", json={"device_code": device_code}
    )


def _session(db):
    return db.scalar(select(PairingSession))


def test_lookup_returns_device_details_and_normalizes_code(
    client, db, admin_headers, sample_property
):
    started = _start(
        client,
        {"hostname": "pi5", "model": "rpi", "agent_version": "2.0"},
        headers={"X-Forwarded-For": "10.32.90.229"},
    )
    user_code = started.json()["user_code"]
    session = _session(db)

    response = _lookup(client, admin_headers, f" {user_code.lower()} ")
    assert response.status_code == 200
    body = response.json()
    assert body["session_id"] == session.id_publico
    assert body["user_code"] == user_code
    assert body["status"] == "pending"
    assert body["device"] == {
        "hostname": "pi5",
        "model": "rpi",
        "agent_version": "2.0",
    }
    assert body["source_network"] == "10.32.90.0/24"
    assert body["requested_at"].endswith("Z")
    assert body["expires_at"].endswith("Z")


def test_lookup_uniform_404_for_unknown_and_terminal_sessions(
    client, db, admin_headers, sample_property
):
    gateway = _gateway(db, sample_property)
    started = _start(client)
    user_code = started.json()["user_code"]
    session = _session(db)

    unknown = _lookup(client, admin_headers, "ZZZZ-ZZZZ")
    assert unknown.status_code == 404
    assert unknown.json()["code"] == "pairing_not_found"

    _approve(client, admin_headers, session.id_publico, user_code, gateway.id)
    _poll(client, started.json()["device_code"])

    reused = _lookup(client, admin_headers, user_code)
    assert reused.status_code == 404
    assert reused.json()["code"] == "pairing_not_found"


def test_approve_requires_confirmation(client, db, admin_headers, sample_property):
    gateway = _gateway(db, sample_property)
    started = _start(client)
    session = _session(db)
    response = _approve(
        client,
        admin_headers,
        session.id_publico,
        started.json()["user_code"],
        gateway.id,
        confirm=False,
    )
    assert response.status_code == 422
    assert response.json()["code"] == "confirmation_required"

    missing = client.post(
        f"/api/v1/gateways/pairing-sessions/{session.id_publico}/approve",
        json={"user_code": started.json()["user_code"], "gateway_id": gateway.id},
        headers=admin_headers,
    )
    assert missing.status_code == 422


def test_approve_pending_gateway_requires_no_replacement(
    client, db, admin_headers, sample_property
):
    gateway = _gateway(db, sample_property)
    started = _start(client)
    session = _session(db)
    response = _approve(
        client,
        admin_headers,
        session.id_publico,
        started.json()["user_code"],
        gateway.id,
        replace_credential=True,
    )
    assert response.status_code == 409
    assert response.json()["code"] == "unexpected_credential_replacement"


def test_approve_active_gateway_requires_replacement(
    client, db, admin_headers, sample_property
):
    gateway = _gateway(db, sample_property, active=True)
    started = _start(client)
    session = _session(db)
    response = _approve(
        client, admin_headers, session.id_publico, started.json()["user_code"], gateway.id
    )
    assert response.status_code == 409
    assert response.json()["code"] == "credential_replacement_required"


def test_approve_unknown_gateway_is_not_found(client, db, admin_headers):
    started = _start(client)
    session = _session(db)
    response = _approve(
        client, admin_headers, session.id_publico, started.json()["user_code"], 999999
    )
    assert response.status_code == 404
    assert response.json()["code"] == "gateway_not_found"


def test_approve_unknown_session_is_uniform_not_found(
    client, db, admin_headers, sample_property
):
    gateway = _gateway(db, sample_property)
    started = _start(client)
    response = _approve(
        client, admin_headers, "does-not-exist", started.json()["user_code"], gateway.id
    )
    assert response.status_code == 404
    assert response.json()["code"] == "pairing_not_found"


def test_deny_unknown_session_is_not_found(client, admin_headers):
    response = _deny(client, admin_headers, "does-not-exist", "BCDF-GHJK")
    assert response.status_code == 404
    assert response.json()["code"] == "pairing_not_found"


def test_wrong_code_lockout_after_failures(client, admin_headers, monkeypatch):
    monkeypatch.setattr(pairing_api, "ADMIN_FAILURE_LIMIT", 2)
    for _ in range(2):
        assert _lookup(client, admin_headers, "ZZZZ-ZZZZ").status_code == 404
    locked = _lookup(client, admin_headers, "ZZZZ-ZZZZ")
    assert locked.status_code == 429
    assert locked.json()["code"] == "too_many_attempts"


def test_per_session_wrong_code_denies_session(
    client, db, admin_headers, sample_property, monkeypatch
):
    monkeypatch.setattr(settings, "PAIRING_MAX_WRONG_CODE_ATTEMPTS", 2)
    gateway = _gateway(db, sample_property)
    started = _start(client)
    session = _session(db)
    device_code = started.json()["device_code"]

    for _ in range(2):
        response = _approve(client, admin_headers, session.id_publico, "ZZZZ-ZZZZ", gateway.id)
        assert response.status_code == 404

    db.refresh(session)
    assert session.estado == "denied"
    assert session.motivo == "denied_by_admin"

    denied = _poll(client, device_code)
    assert denied.status_code == 400
    assert denied.json()["code"] == "access_denied"


def test_approve_active_gateway_rotates_credential_through_api(
    client, db, admin_headers, sample_gateway
):
    gateway, old_credential = sample_gateway
    old_hash = gateway.credencial_hash
    started = _start(client)
    user_code = started.json()["user_code"]
    session = _session(db)

    approved = _approve(
        client,
        admin_headers,
        session.id_publico,
        user_code,
        gateway.id,
        replace_credential=True,
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    token = _poll(client, started.json()["device_code"])
    assert token.status_code == 200
    new_credential = token.json()["credential"]
    assert new_credential.startswith("gk_")
    assert new_credential != old_credential

    db.refresh(gateway)
    assert gateway.estado == "active"
    assert gateway.credencial_hash != old_hash
    assert [slot.nodo_id for slot in gateway.slots]


def test_admin_routes_require_admin(client, client_headers, sample_property):
    response = client.post(
        "/api/v1/gateways/pairing-sessions/lookup",
        json={"user_code": "ZZZZ-ZZZZ"},
        headers=client_headers,
    )
    assert response.status_code == 403
    assert client.post(
        "/api/v1/gateways/pairing-sessions/lookup", json={"user_code": "ZZZZ-ZZZZ"}
    ).status_code == 401


def test_disabled_flag_gates_admin_routes(client, admin_headers, monkeypatch):
    monkeypatch.setattr(settings, "GATEWAY_PAIRING_ENABLED", False)
    response = _lookup(client, admin_headers, "ZZZZ-ZZZZ")
    assert response.status_code == 503
    assert response.json()["code"] == "pairing_unavailable"


def test_admin_logs_never_contain_codes(
    client, db, admin_headers, sample_property, caplog
):
    gateway = _gateway(db, sample_property)
    caplog.set_level(logging.INFO, logger="app.api.v1.endpoints.gateway_pairing")
    started = _start(client)
    device_code = started.json()["device_code"]
    user_code = started.json()["user_code"]
    session = _session(db)

    _lookup(client, admin_headers, user_code)
    _approve(client, admin_headers, session.id_publico, user_code, gateway.id)

    assert device_code not in caplog.text
    assert user_code not in caplog.text
    assert user_code.replace("-", "") not in caplog.text
    assert session.id_publico in caplog.text
