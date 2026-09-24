from copy import deepcopy
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import func, select

from app.models import Client, IrrigationArea, Node, Property, Reading, User
from tests.integration.test_readings_api import SENSOR_PAYLOAD


def _post(client, payload, headers):
    return client.post(
        "/api/v1/readings",
        json=payload,
        headers={**headers, "X-Event-ID": str(uuid4())},
    )


def test_gateway_creates_reading_with_configured_node_identity(
    client, db, node_headers, sample_node, sample_gateway
):
    response = _post(client, SENSOR_PAYLOAD, node_headers)
    assert response.status_code == 201
    stored = db.get(Reading, response.json()["id"])
    assert stored.nodo_id == sample_node.id
    assert stored.pasarela_id == sample_gateway[0].id


def test_legacy_node_key_is_rejected_for_telemetry(
    client, db, legacy_node_headers, sample_node
):
    response = _post(
        client,
        SENSOR_PAYLOAD,
        {**legacy_node_headers, "X-Logical-Node-Id": str(sample_node.id)},
    )
    assert response.status_code == 401
    assert db.scalar(select(func.count()).select_from(Reading)) == 0


def test_gateway_cannot_submit_unconfigured_or_cross_property_node(
    client, db, node_headers
):
    response = _post(
        client,
        SENSOR_PAYLOAD,
        {**node_headers, "X-Logical-Node-Id": "999999"},
    )
    assert response.status_code == 403
    assert db.scalar(select(func.count()).select_from(Reading)) == 0


def test_gateway_cannot_submit_foreign_property_logical_node(
    client, db, node_headers, sample_crop_type
):
    user = User(
        correo="foreign-ingest@test.com",
        contrasena_hash="unused",
        nombre_completo="Foreign Client",
        rol="cliente",
        activo=True,
    )
    db.add(user)
    db.flush()
    client_record = Client(usuario_id=user.id, nombre_empresa="Foreign Farm")
    db.add(client_record)
    db.flush()
    property_record = Property(cliente_id=client_record.id, nombre="Foreign Property")
    db.add(property_record)
    db.flush()
    area = IrrigationArea(
        predio_id=property_record.id,
        tipo_cultivo_id=sample_crop_type.id,
        nombre="Foreign Area",
    )
    db.add(area)
    db.flush()
    node = Node(area_riego_id=area.id, api_key="legacy-foreign-key", activo=True)
    db.add(node)
    db.commit()

    response = _post(
        client,
        SENSOR_PAYLOAD,
        {**node_headers, "X-Logical-Node-Id": str(node.id)},
    )
    assert response.status_code == 403
    assert db.scalar(select(func.count()).select_from(Reading)) == 0


def test_logical_node_header_is_required(client, db, node_headers):
    headers = {**node_headers, "X-Event-ID": str(uuid4())}
    headers.pop("X-Logical-Node-Id")
    response = client.post("/api/v1/readings", json=SENSOR_PAYLOAD, headers=headers)
    assert response.status_code == 422
    assert db.scalar(select(func.count()).select_from(Reading)) == 0


def test_payload_requires_exactly_twelve_dynamic_fields(client, db, node_headers):
    for extra in (
        {"crop_type": "Nogal"},
        {"ndvi": 0.7},
        {"soil": {**SENSOR_PAYLOAD["soil"], "gps": "static"}},
    ):
        response = _post(client, {**deepcopy(SENSOR_PAYLOAD), **extra}, node_headers)
        assert response.status_code == 422
    assert db.scalar(select(func.count()).select_from(Reading)) == 0


def test_timestamp_requires_explicit_z_and_all_fields_are_present(client, db, node_headers):
    for payload in (
        {**SENSOR_PAYLOAD, "timestamp": "2026-04-01T10:00:00+00:00"},
        {key: value for key, value in SENSOR_PAYLOAD.items() if key != "environmental"},
        {
            **SENSOR_PAYLOAD,
            "soil": {key: value for key, value in SENSOR_PAYLOAD["soil"].items() if key != "humidity"},
        },
    ):
        response = _post(client, payload, node_headers)
        assert response.status_code == 422
    assert db.scalar(select(func.count()).select_from(Reading)) == 0


def test_late_reading_keeps_original_capture_time_and_does_not_replace_latest(
    client, admin_headers, db, node_headers, sample_node, sample_irrigation_area
):
    now = datetime.now(UTC)
    newer = (now - timedelta(minutes=10)).replace(microsecond=0)
    older = (now - timedelta(minutes=20)).replace(microsecond=0)
    first = _post(
        client,
        {**SENSOR_PAYLOAD, "timestamp": newer.isoformat().replace("+00:00", "Z")},
        node_headers,
    )
    late = _post(
        client,
        {**SENSOR_PAYLOAD, "timestamp": older.isoformat().replace("+00:00", "Z")},
        node_headers,
    )
    assert first.status_code == late.status_code == 201
    assert db.get(Reading, late.json()["id"]).marca_tiempo == older.replace(tzinfo=None)
    latest = client.get(
        f"/api/v1/readings/latest?irrigation_area_id={sample_irrigation_area.id}",
        headers=admin_headers,
    )
    assert latest.status_code == 200
    assert latest.json()["timestamp"] == newer.isoformat().replace("+00:00", "Z")


def test_anomalous_timestamp_is_retained_with_suspicious_marker(
    client, admin_headers, db, node_headers, sample_irrigation_area
):
    timestamp = (
        (datetime.now(UTC) - timedelta(days=45))
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )
    response = _post(client, {**SENSOR_PAYLOAD, "timestamp": timestamp}, node_headers)
    assert response.status_code == 201
    row = db.get(Reading, response.json()["id"])
    assert row.marca_tiempo.isoformat() == timestamp.removesuffix("Z")
    assert row.marca_tiempo_sospechosa is True
    latest = client.get(
        f"/api/v1/readings/latest?irrigation_area_id={sample_irrigation_area.id}",
        headers=admin_headers,
    )
    assert latest.json()["timestamp_suspicious"] is True
