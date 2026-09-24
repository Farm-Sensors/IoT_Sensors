import hashlib
from datetime import UTC, datetime, timedelta

from app.models import Gateway, GatewaySlot, IrrigationArea, Node, PhysicalBinding, Property


def _active_gateway(db, property_id, node, *, credential=None):
    credential = credential or f"gk_test_gateway_secret_{property_id}"
    gateway = Gateway(
        predio_id=property_id,
        estado="active",
        credencial_hash=hashlib.sha256(credential.encode()).hexdigest(),
        credencial_prefijo="gk_test_gat",
        activado_en=datetime.now(UTC).replace(tzinfo=None),
    )
    db.add(gateway)
    db.flush()
    slot = GatewaySlot(
        pasarela_id=gateway.id,
        nodo_id=node.id,
        area_riego_id=node.area_riego_id,
    )
    db.add(slot)
    db.commit()
    db.refresh(gateway)
    db.refresh(slot)
    return gateway, slot, {"X-API-Key": credential}


def _publish(client, gateway, admin_headers):
    return client.post(
        f"/api/v1/gateways/{gateway.id}/configuration", headers=admin_headers
    )


def _candidate(slot, *, uid="physical-uid-1", serial="physical-serial-1"):
    return {
        "slot_id": slot.id,
        "logical_node_id": slot.nodo_id,
        "irrigation_area_id": slot.area_riego_id,
        "uid": uid,
        "serial": serial,
    }


def test_poll_auth_is_scoped_and_304_requires_both_exact_revisions(
    client, db, sample_property, sample_node, admin_headers
):
    gateway, slot, headers = _active_gateway(db, sample_property.id, sample_node)
    assert _publish(client, gateway, admin_headers).json()["configuration_version"] == 1

    first = client.get("/api/v1/gateways/me/configuration", headers=headers)
    assert first.status_code == 200
    assert first.json()["configuration"]["slots"] == [
        {
            "slot_id": slot.id,
            "logical_node_id": slot.nodo_id,
            "irrigation_area_id": slot.area_riego_id,
            "hardware_profile_code": None,
        }
    ]
    assert first.json()["binding_overlay"]["slots"][0]["binding_status"] == "unbound"

    no_binding_revision = client.get(
        "/api/v1/gateways/me/configuration",
        headers=headers | {"X-Config-Version": "1"},
    )
    assert no_binding_revision.status_code == 200
    exact = client.get(
        "/api/v1/gateways/me/configuration",
        headers=headers | {"X-Config-Version": "1", "X-Bindings-Revision": "0"},
    )
    assert exact.status_code == 304 and not exact.content
    assert client.get("/api/v1/gateways/me/configuration").status_code == 401
    assert client.get(
        "/api/v1/gateways/me/configuration", headers={"X-API-Key": "ak_test_key_000"}
    ).status_code == 401


def test_candidate_retry_and_confirmation_are_gateway_owned_and_keep_history(
    client, db, sample_property, sample_node, admin_headers
):
    gateway, slot, headers = _active_gateway(db, sample_property.id, sample_node)
    _publish(client, gateway, admin_headers)

    proposed_body = _candidate(slot)
    candidate_response = client.post(
        "/api/v1/gateways/me/binding-candidates",
        headers=headers | {"X-Event-ID": "proposal-1"},
        json=proposed_body,
    )
    assert candidate_response.status_code == 201
    candidate = candidate_response.json()
    assert candidate["binding_status"] == "pending_initial"
    assert gateway.bindings_revision == 1

    exact_retry = client.post(
        "/api/v1/gateways/me/binding-candidates",
        headers=headers | {"X-Event-ID": "proposal-1"},
        json=proposed_body,
    )
    assert exact_retry.status_code == 200
    assert exact_retry.json()["candidate_id"] == candidate["candidate_id"]
    conflict_retry = client.post(
        "/api/v1/gateways/me/binding-candidates",
        headers=headers | {"X-Event-ID": "proposal-1"},
        json=_candidate(slot, uid="different-uid"),
    )
    assert conflict_retry.status_code == 409
    duplicate = client.post(
        "/api/v1/gateways/me/binding-candidates",
        headers=headers | {"X-Event-ID": "proposal-2"},
        json=_candidate(slot, uid="another-uid"),
    )
    assert duplicate.status_code == 409
    stale_overlay = client.get(
        "/api/v1/gateways/me/configuration",
        headers=headers | {"X-Config-Version": "1", "X-Bindings-Revision": "0"},
    )
    assert stale_overlay.status_code == 200
    assert stale_overlay.json()["configuration_version"] == 1
    assert stale_overlay.json()["bindings_revision"] == 1
    assert stale_overlay.json()["binding_overlay"]["slots"][0]["binding_status"] == "pending_initial"

    other_property = Property(
        cliente_id=sample_property.cliente_id,
        nombre="Other Property",
        ubicacion="Chihuahua",
    )
    db.add(other_property)
    db.flush()
    other_area = IrrigationArea(
        predio_id=other_property.id,
        tipo_cultivo_id=sample_node.irrigation_area.tipo_cultivo_id,
        nombre="Other Area",
    )
    db.add(other_area)
    db.flush()
    other_node = Node(area_riego_id=other_area.id, activo=True)
    db.add(other_node)
    db.commit()
    other_gateway, other_slot, other_headers = _active_gateway(db, other_property.id, other_node)
    _publish(client, other_gateway, admin_headers)

    # A different authenticated gateway cannot confirm this gateway's candidate.
    foreign = client.post(
        f"/api/v1/gateways/me/binding-candidates/{candidate['candidate_id']}/confirm",
        headers=other_headers | {"X-Event-ID": "confirm-foreign"},
        json={"slot_id": other_slot.id, "technician_confirmed_at": "2026-09-24T20:00:00Z"},
    )
    assert foreign.status_code == 404

    confirmed_at = (datetime.now(UTC) + timedelta(minutes=2)).isoformat().replace("+00:00", "Z")
    confirmation = {
        "slot_id": slot.id,
        "technician_confirmed_at": confirmed_at,
    }
    accepted = client.post(
        f"/api/v1/gateways/me/binding-candidates/{candidate['candidate_id']}/confirm",
        headers=headers | {"X-Event-ID": "confirm-1"},
        json=confirmation,
    )
    assert accepted.status_code == 200
    assert accepted.json()["binding_status"] == "confirmed"
    replay = client.post(
        f"/api/v1/gateways/me/binding-candidates/{candidate['candidate_id']}/confirm",
        headers=headers | {"X-Event-ID": "confirm-1"},
        json=confirmation,
    )
    assert replay.status_code == 200
    assert gateway.bindings_revision == 2
    assert db.query(PhysicalBinding).filter_by(estado="confirmed").count() == 1


def test_reassignment_keeps_current_binding_until_confirmation_and_preserves_history(
    client, db, sample_property, sample_node, admin_headers
):
    gateway, slot, headers = _active_gateway(db, sample_property.id, sample_node)
    _publish(client, gateway, admin_headers)
    first_candidate = client.post(
        "/api/v1/gateways/me/binding-candidates",
        headers=headers | {"X-Event-ID": "proposal-initial"},
        json=_candidate(slot),
    ).json()
    first_time = (datetime.now(UTC) + timedelta(minutes=2)).isoformat().replace("+00:00", "Z")
    client.post(
        f"/api/v1/gateways/me/binding-candidates/{first_candidate['candidate_id']}/confirm",
        headers=headers | {"X-Event-ID": "confirm-initial"},
        json={"slot_id": slot.id, "technician_confirmed_at": first_time},
    )

    replacement = client.post(
        "/api/v1/gateways/me/binding-candidates",
        headers=headers | {"X-Event-ID": "proposal-replacement"},
        json=_candidate(slot, uid="physical-uid-2", serial="physical-serial-2"),
    )
    assert replacement.status_code == 201
    assert replacement.json()["binding_status"] == "pending_reassignment"
    pending_overlay = client.get("/api/v1/gateways/me/configuration", headers=headers)
    overlay_slot = pending_overlay.json()["binding_overlay"]["slots"][0]
    assert overlay_slot["binding_status"] == "pending_reassignment"
    assert overlay_slot["current_binding"]["uid"] == "physical-uid-1"
    assert overlay_slot["pending_binding"]["uid"] == "physical-uid-2"

    second_time = (datetime.now(UTC) + timedelta(minutes=5)).isoformat().replace("+00:00", "Z")
    client.post(
        f"/api/v1/gateways/me/binding-candidates/{replacement.json()['candidate_id']}/confirm",
        headers=headers | {"X-Event-ID": "confirm-replacement"},
        json={"slot_id": slot.id, "technician_confirmed_at": second_time},
    )
    records = db.query(PhysicalBinding).order_by(PhysicalBinding.id).all()
    assert [row.estado for row in records] == ["closed", "confirmed"]
    assert records[0].uid == "physical-uid-1" and records[0].cerrado_en is not None
    assert records[1].uid == "physical-uid-2"
    assert sample_node.id == records[0].nodo_id == records[1].nodo_id

    current_overlay = client.get("/api/v1/gateways/me/configuration", headers=headers).json()
    overlay_slot = current_overlay["binding_overlay"]["slots"][0]
    assert overlay_slot["binding_status"] == "confirmed"
    assert overlay_slot["current_binding"]["uid"] == "physical-uid-2"


def test_candidate_requires_explicit_configured_slot_and_rejects_invalid_confirmation(
    client, db, sample_property, sample_node, admin_headers
):
    gateway, slot, headers = _active_gateway(db, sample_property.id, sample_node)
    body = _candidate(slot)
    before_publish = client.post(
        "/api/v1/gateways/me/binding-candidates",
        headers=headers | {"X-Event-ID": "no-config"},
        json=body,
    )
    assert before_publish.status_code == 409
    _publish(client, gateway, admin_headers)

    wrong_area = client.post(
        "/api/v1/gateways/me/binding-candidates",
        headers=headers | {"X-Event-ID": "wrong-area"},
        json=body | {"irrigation_area_id": slot.area_riego_id + 100},
    )
    assert wrong_area.status_code == 403
    no_selection = client.post(
        "/api/v1/gateways/me/binding-candidates",
        headers=headers | {"X-Event-ID": "no-selection"},
        json={"uid": "u", "serial": "s"},
    )
    assert no_selection.status_code == 422
    candidate = client.post(
        "/api/v1/gateways/me/binding-candidates",
        headers=headers | {"X-Event-ID": "proposal-ok"},
        json=body,
    ).json()
    naive = client.post(
        f"/api/v1/gateways/me/binding-candidates/{candidate['candidate_id']}/confirm",
        headers=headers | {"X-Event-ID": "naive-confirm"},
        json={"slot_id": slot.id, "technician_confirmed_at": "2026-09-24T20:00:00"},
    )
    assert naive.status_code == 422
    wrong_slot = client.post(
        f"/api/v1/gateways/me/binding-candidates/{candidate['candidate_id']}/confirm",
        headers=headers | {"X-Event-ID": "wrong-slot"},
        json={
            "slot_id": slot.id + 100,
            "technician_confirmed_at": "2026-09-24T20:00:00Z",
        },
    )
    assert wrong_slot.status_code == 403
    assert db.query(PhysicalBinding).filter_by(estado="pending").count() == 1
