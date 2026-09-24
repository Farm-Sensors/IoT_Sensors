"""Telemetry event identity, retries, and atomic conflict handling."""

from copy import deepcopy
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app.models.irrigation_area import IrrigationArea
from app.models.node import Node
from app.models.gateway_config import GatewayConfig
from app.models.gateway_slot import GatewaySlot
from app.models.reading import Reading
from app.services import reading as service
from tests.integration.test_readings_api import SENSOR_PAYLOAD


def reading_count(db):
    return db.scalar(select(func.count()).select_from(Reading))


def test_exact_retry_returns_original_response_without_side_effects(
    client, db, node_headers, monkeypatch
):
    calls = []
    original = service._create_threshold_alerts

    def track_alerts(*args):
        calls.append(1)
        return original(*args)

    monkeypatch.setattr(service, "_create_threshold_alerts", track_alerts)
    headers = {**node_headers, "X-Event-ID": str(uuid4())}
    first = client.post("/api/v1/readings", json=SENSOR_PAYLOAD, headers=headers)
    assert first.status_code == 201
    db.expire_all()
    for _ in range(3):
        retry = client.post("/api/v1/readings", json=SENSOR_PAYLOAD, headers=headers)
        assert retry.status_code == 200
        assert retry.json() == first.json()
    assert reading_count(db) == 1
    assert len(calls) == 1
    stored = db.scalar(select(Reading))
    assert stored.event_id == headers["X-Event-ID"]
    assert len(stored.payload_hash) == 64
    assert "event_id" not in first.json()
    assert "payload_hash" not in first.json()


@pytest.mark.parametrize(
    "category,field,value",
    [
        (None, "timestamp", "2026-04-01T11:00:00Z"),
        ("soil", "conductivity", 2.5001),  # same stored decimal after rounding
        ("soil", "temperature", None),
        ("soil", "humidity", 0),
        ("soil", "water_potential", -0.9),
        ("irrigation", "active", False),
        ("irrigation", "accumulated_liters", 0),
        ("irrigation", "flow_per_minute", None),
        ("environmental", "temperature", 29),
        ("environmental", "relative_humidity", 0),
        ("environmental", "wind_speed", None),
        ("environmental", "solar_radiation", 0),
        ("environmental", "eto", 5.201),
    ],
)
def test_changed_body_conflicts_without_mutation(client, db, node_headers, category, field, value):
    headers = {**node_headers, "X-Event-ID": str(uuid4())}
    first = client.post("/api/v1/readings", json=SENSOR_PAYLOAD, headers=headers)
    assert first.status_code == 201
    before = dict(db.execute(select(Reading.__table__)).mappings().one())
    changed = deepcopy(SENSOR_PAYLOAD)
    (changed if category is None else changed[category])[field] = value
    conflict = client.post("/api/v1/readings", json=changed, headers=headers)
    assert conflict.status_code == 409
    assert reading_count(db) == 1
    after = dict(db.execute(select(Reading.__table__)).mappings().one())
    assert after == before
    retry = client.post("/api/v1/readings", json=SENSOR_PAYLOAD, headers=headers)
    assert retry.status_code == 200
    assert retry.json() == first.json()


@pytest.mark.parametrize("event_id", [None, "", "not-a-uuid", "x" * 1000])
def test_missing_or_invalid_event_id_does_not_write(client, db, node_headers, event_id):
    headers = dict(node_headers)
    if event_id is not None:
        headers["X-Event-ID"] = event_id
    response = client.post("/api/v1/readings", json=SENSOR_PAYLOAD, headers=headers)
    assert response.status_code == 422
    assert reading_count(db) == 0


@pytest.mark.parametrize("api_key,expected", [(None, 401), ("", 401), ("invalid", 401)])
def test_missing_or_invalid_key_does_not_write(client, db, api_key, expected):
    headers = {"X-Event-ID": str(uuid4())}
    if api_key is not None:
        headers["X-API-Key"] = api_key
    response = client.post("/api/v1/readings", json=SENSOR_PAYLOAD, headers=headers)
    assert response.status_code == expected
    assert reading_count(db) == 0


def test_retry_still_requires_active_configured_node(client, db, node_headers, sample_node):
    headers = {**node_headers, "X-Event-ID": str(uuid4())}
    assert client.post("/api/v1/readings", json=SENSOR_PAYLOAD, headers=headers).status_code == 201
    sample_node.activo = False
    db.commit()
    assert client.post("/api/v1/readings", json=SENSOR_PAYLOAD, headers=headers).status_code == 403
    assert reading_count(db) == 1


def test_invalid_body_does_not_reserve_event_id(client, db, node_headers):
    headers = {**node_headers, "X-Event-ID": str(uuid4())}
    invalid = {**SENSOR_PAYLOAD, "timestamp": "invalid"}
    assert client.post("/api/v1/readings", json=invalid, headers=headers).status_code == 422
    assert reading_count(db) == 0
    assert client.post("/api/v1/readings", json=SENSOR_PAYLOAD, headers=headers).status_code == 201


def test_event_id_is_scoped_to_gateway_and_logical_node(
    client, db, node_headers, sample_gateway, sample_irrigation_area
):
    area = IrrigationArea(
        predio_id=sample_irrigation_area.predio_id,
        tipo_cultivo_id=sample_irrigation_area.tipo_cultivo_id,
        nombre="Second area",
        tamano_area=1,
    )
    db.add(area)
    db.flush()
    node = Node(area_riego_id=area.id, api_key="test-only-second-node", activo=True)
    db.add(node)
    db.flush()
    gateway = sample_gateway[0]
    slot = GatewaySlot(
        pasarela_id=gateway.id,
        nodo_id=node.id,
        area_riego_id=area.id,
    )
    db.add(slot)
    db.flush()
    config = db.scalar(
        select(GatewayConfig).where(
            GatewayConfig.pasarela_id == gateway.id,
            GatewayConfig.version == gateway.config_version_activa,
        )
    )
    config.snapshot["slots"].append(
        {
            "slot_id": slot.id,
            "logical_node_id": node.id,
            "irrigation_area_id": area.id,
            "hardware_profile_code": None,
        }
    )
    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(config, "snapshot")
    db.commit()
    event_id = str(uuid4())
    first = client.post(
        "/api/v1/readings", json=SENSOR_PAYLOAD, headers={**node_headers, "X-Event-ID": event_id}
    )
    second = client.post(
        "/api/v1/readings",
        json=SENSOR_PAYLOAD,
        headers={
            **node_headers,
            "X-Logical-Node-Id": str(node.id),
            "X-Event-ID": event_id,
        },
    )
    assert first.status_code == second.status_code == 201
    assert first.json()["id"] != second.json()["id"]
    assert reading_count(db) == 2


def test_same_body_with_new_event_id_is_new_reading(client, db, node_headers):
    for _ in range(2):
        response = client.post(
            "/api/v1/readings",
            json=SENSOR_PAYLOAD,
            headers={**node_headers, "X-Event-ID": str(uuid4())},
        )
        assert response.status_code == 201
    assert reading_count(db) == 2


def test_json_formatting_and_uuid_case_do_not_change_identity(client, db, node_headers):
    import json

    event_id = str(uuid4())
    first = client.post(
        "/api/v1/readings", json=SENSOR_PAYLOAD, headers={**node_headers, "X-Event-ID": event_id}
    )
    reordered = dict(reversed(list(SENSOR_PAYLOAD.items())))
    retry = client.post(
        "/api/v1/readings",
        content=json.dumps(reordered, indent=4),
        headers={
            **node_headers,
            "X-Event-ID": event_id.upper(),
            "Content-Type": "application/json",
        },
    )
    assert first.status_code == 201
    assert retry.status_code == 200
    assert retry.json() == first.json()
    assert reading_count(db) == 1
