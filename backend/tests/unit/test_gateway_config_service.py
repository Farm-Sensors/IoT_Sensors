from datetime import UTC, datetime, timedelta

import pytest

from app.models import Gateway, GatewayConfig, GatewaySlot, HardwareProfile, PhysicalBinding
from app.services.gateway_config import poll_configuration, publish_configuration
from app.services.gateway_heartbeat import EDGE_STATUS


@pytest.fixture
def gateway(db, sample_property):
    row = Gateway(predio_id=sample_property.id)
    db.add(row)
    db.flush()
    return row


@pytest.fixture
def slot(db, gateway, sample_node):
    row = GatewaySlot(
        pasarela_id=gateway.id,
        nodo_id=sample_node.id,
        area_riego_id=sample_node.area_riego_id,
    )
    db.add(row)
    db.flush()
    return row


def test_publication_is_monotonic_and_snapshots_are_immutable(db, gateway, slot, admin_user):
    profile = HardwareProfile(codigo="soil-probe-v1", nombre="Soil probe")
    db.add(profile)
    db.flush()
    slot.perfil_hardware_id = profile.id
    db.flush()
    first = publish_configuration(db, gateway.id, admin_user.id)
    assert first.version == 1
    assert first.snapshot["slots"] == [
        {
            "slot_id": slot.id,
            "logical_node_id": slot.nodo_id,
            "irrigation_area_id": slot.area_riego_id,
            "hardware_profile_code": "soil-probe-v1",
        }
    ]

    profile.codigo = "soil-probe-v2"
    db.flush()
    second = publish_configuration(db, gateway.id, admin_user.id)
    assert second.version == 2
    assert gateway.config_version_activa == 2
    assert first.snapshot["slots"][0]["hardware_profile_code"] == "soil-probe-v1"
    assert second.snapshot["slots"][0]["hardware_profile_code"] == "soil-probe-v2"
    assert db.query(GatewayConfig).count() == 2


def test_poll_only_returns_not_modified_when_both_revisions_match(db, gateway, slot, admin_user):
    publish_configuration(db, gateway.id, admin_user.id)
    code, payload = poll_configuration(db, gateway, None, None)
    assert code == 200
    assert payload["configuration_version"] == 1
    assert payload["binding_overlay"]["slots"][0]["binding_status"] == "unbound"

    code, payload = poll_configuration(db, gateway, 1, None)
    assert code == 200 and payload is not None
    code, payload = poll_configuration(db, gateway, 1, 1)
    assert code == 200 and payload is not None
    code, payload = poll_configuration(db, gateway, 1, 0)
    assert code == 304 and payload is None


def test_poll_payload_reports_cloud_and_edge_status_from_heartbeat(
    db, gateway, slot, admin_user
):
    publish_configuration(db, gateway.id, admin_user.id)

    gateway.estado = "pending_activation"
    db.flush()
    _, payload = poll_configuration(db, gateway, None, None)
    assert payload["cloud_status"] == "inactive"
    assert payload["edge_status"] == EDGE_STATUS["inactive"] == "pending"

    gateway.estado = "active"
    gateway.ultimo_heartbeat_en = None
    db.flush()
    _, payload = poll_configuration(db, gateway, None, None)
    assert payload["cloud_status"] == "never_seen"
    assert payload["edge_status"] == "pending"

    gateway.ultimo_heartbeat_en = datetime.now(UTC).replace(tzinfo=None)
    db.flush()
    _, payload = poll_configuration(db, gateway, None, None)
    assert payload["cloud_status"] == "recently_seen"
    assert payload["edge_status"] == EDGE_STATUS[payload["cloud_status"]] == "connected"

    gateway.ultimo_heartbeat_en = (datetime.now(UTC) - timedelta(days=1)).replace(tzinfo=None)
    db.flush()
    _, payload = poll_configuration(db, gateway, None, None)
    assert payload["cloud_status"] == "disconnected"
    assert payload["edge_status"] == "disconnected"


def test_poll_binding_objects_expose_exact_contract_keys(db, gateway, slot, admin_user):
    publish_configuration(db, gateway.id, admin_user.id)
    proposed = datetime(2026, 1, 2, 3, 4, 5)
    confirmed = datetime(2026, 1, 2, 3, 9, 5)
    current = PhysicalBinding(
        pasarela_id=gateway.id,
        ranura_id=slot.id,
        nodo_id=slot.nodo_id,
        area_riego_id=slot.area_riego_id,
        uid="uid-current",
        numero_serie="serial-current",
        estado="confirmed",
        propuesto_en=proposed,
        confirmado_en=confirmed,
        confirmado_por_pasarela_id=gateway.id,
    )
    pending = PhysicalBinding(
        pasarela_id=gateway.id,
        ranura_id=slot.id,
        nodo_id=slot.nodo_id,
        area_riego_id=slot.area_riego_id,
        uid="uid-pending",
        numero_serie="serial-pending",
        estado="pending",
        propuesto_en=confirmed,
    )
    db.add_all([current, pending])
    db.flush()

    _, payload = poll_configuration(db, gateway, None, None)
    overlay_slot = payload["binding_overlay"]["slots"][0]
    assert overlay_slot["binding_status"] == "pending_reassignment"
    assert overlay_slot["current_binding"] == {
        "candidate_id": current.id,
        "uid": "uid-current",
        "serial": "serial-current",
        "submitted_at": "2026-01-02T03:04:05Z",
        "confirmed_at": "2026-01-02T03:09:05Z",
    }
    assert overlay_slot["pending_binding"] == {
        "candidate_id": pending.id,
        "uid": "uid-pending",
        "serial": "serial-pending",
        "submitted_at": "2026-01-02T03:09:05Z",
        "confirmed_at": None,
    }
