import pytest

from app.models import Gateway, GatewayConfig, GatewaySlot, HardwareProfile
from app.services.gateway_config import poll_configuration, publish_configuration


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
