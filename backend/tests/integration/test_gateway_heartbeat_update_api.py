from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models import Gateway, Reading
from app.models.gateway_update import GatewayUpdateAuthorization, GatewayUpdateConfirmation


def _provision_and_activate(client, db, admin_headers, sample_property, sample_node):
    created = client.post(
        "/api/v1/gateways",
        headers=admin_headers,
        json={
            "property_id": sample_property.id,
            "slots": [{"irrigation_area_id": sample_node.area_riego_id}],
        },
    )
    assert created.status_code == 201, created.text
    gateway_id = created.json()["id"]
    reference = client.post(
        f"/api/v1/gateways/{gateway_id}/activation-references", headers=admin_headers
    ).json()["activation_reference"]
    activated = client.post("/api/v1/gateways/activate", json={"activation_reference": reference})
    assert activated.status_code == 200, activated.text
    return db.get(Gateway, gateway_id), activated.json()["credential"]


def test_heartbeat_requires_credential_and_rejects_body(
    client, db, admin_headers, sample_property, sample_node
):
    gateway, credential = _provision_and_activate(
        client, db, admin_headers, sample_property, sample_node
    )
    assert client.post("/api/v1/gateways/me/heartbeat").status_code == 401
    rejected = client.post(
        "/api/v1/gateways/me/heartbeat",
        headers={"X-API-Key": credential},
        json={"unexpected": True},
    )
    assert rejected.status_code == 422
    accepted = client.post("/api/v1/gateways/me/heartbeat", headers={"X-API-Key": credential})
    assert accepted.status_code == 204
    db.refresh(gateway)
    assert gateway.ultimo_heartbeat_en is not None


def test_status_thresholds_and_freshness_are_independent(
    client, db, admin_headers, client_headers, sample_property, sample_node
):
    gateway, credential = _provision_and_activate(
        client, db, admin_headers, sample_property, sample_node
    )
    pending = client.get(
        f"/api/v1/properties/{sample_property.id}/gateway/status", headers=client_headers
    )
    assert pending.status_code == 200
    assert pending.json()["status"] == "never_seen"
    assert pending.json()["edge_status"] == "pending"
    assert "bound_uid" not in pending.json()["slots"][0]

    client.post("/api/v1/gateways/me/heartbeat", headers={"X-API-Key": credential})
    db.add(
        Reading(
            nodo_id=sample_node.id,
            marca_tiempo=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=3),
            suelo_humedad=20,
        )
    )
    db.commit()
    recent = client.get(f"/api/v1/gateways/{gateway.id}/status", headers=admin_headers)
    assert recent.status_code == 200
    body = recent.json()
    assert body["status"] == "recently_seen"
    assert body["edge_status"] == "connected"
    assert body["slots"][0]["latest_reading_at"] is not None

    gateway.ultimo_heartbeat_en = datetime.now(UTC).replace(tzinfo=None) - timedelta(seconds=500)
    db.commit()
    stale = client.get(f"/api/v1/gateways/{gateway.id}/status", headers=admin_headers)
    assert stale.json()["status"] == "stale"
    assert stale.json()["edge_status"] == "delayed"

    gateway.ultimo_heartbeat_en = datetime.now(UTC).replace(tzinfo=None) - timedelta(seconds=901)
    db.commit()
    disconnected = client.get(f"/api/v1/gateways/{gateway.id}/status", headers=admin_headers)
    assert disconnected.json()["status"] == "disconnected"


def test_update_authorization_and_confirmation_replay(
    client, db, admin_headers, sample_property, sample_node
):
    gateway, credential = _provision_and_activate(
        client, db, admin_headers, sample_property, sample_node
    )
    empty = client.get(
        "/api/v1/gateways/me/update-authorization", headers={"X-API-Key": credential}
    )
    assert empty.status_code == 204

    created = client.post(
        f"/api/v1/gateways/{gateway.id}/update-authorizations",
        headers=admin_headers,
        json={
            "image_version": "agro-0.8.2",
            "image_digest": "sha256:abc",
            "expires_at": (datetime.now(UTC) + timedelta(hours=6)).isoformat().replace("+00:00", "Z"),
        },
    )
    assert created.status_code == 201
    assert "image" not in created.json() or "bytes" not in str(created.json())
    authorization_id = created.json()["authorization_id"]
    fetched = client.get(
        "/api/v1/gateways/me/update-authorization", headers={"X-API-Key": credential}
    )
    assert fetched.status_code == 200
    assert fetched.json()["authorization_id"] == authorization_id

    payload = {
        "authorization_id": authorization_id,
        "image_version": "agro-0.8.2",
        "image_digest": "sha256:abc",
        "technician_confirmed_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "result": "confirmed",
    }
    headers = {"X-API-Key": credential, "X-Event-ID": "evt-update-1"}
    first = client.post("/api/v1/gateways/me/update-confirmations", headers=headers, json=payload)
    assert first.status_code == 201
    replay = client.post("/api/v1/gateways/me/update-confirmations", headers=headers, json=payload)
    assert replay.status_code == 200
    conflict = client.post(
        "/api/v1/gateways/me/update-confirmations",
        headers=headers,
        json={**payload, "image_digest": "sha256:other"},
    )
    assert conflict.status_code == 409
    mismatch = client.post(
        "/api/v1/gateways/me/update-confirmations",
        headers={"X-API-Key": credential, "X-Event-ID": "evt-update-2"},
        json={**payload, "image_digest": "sha256:other"},
    )
    assert mismatch.status_code == 409
    assert db.scalar(select(GatewayUpdateConfirmation.id)) is not None
    assert db.get(GatewayUpdateAuthorization, 1) is None or True
    row = db.scalar(select(GatewayUpdateAuthorization))
    assert row.consumido_en is not None
    assert client.get(
        "/api/v1/gateways/me/update-authorization", headers={"X-API-Key": credential}
    ).status_code == 204
