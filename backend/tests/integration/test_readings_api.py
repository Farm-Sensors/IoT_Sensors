"""Tests de integración para /api/v1/readings (POST ingesta + GET historia + export)."""

from uuid import uuid4

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.models.reading import Reading
from app.schemas.reading import ReadingResponse

SENSOR_PAYLOAD = {
    "timestamp": "2026-04-01T10:00:00Z",
    "soil": {
        "conductivity": 2.5,
        "temperature": 22.3,
        "humidity": 45.6,
        "water_potential": -0.8,
    },
    "irrigation": {
        "active": True,
        "accumulated_liters": 1250.0,
        "flow_per_minute": 8.3,
    },
    "environmental": {
        "temperature": 28.1,
        "relative_humidity": 55.0,
        "wind_speed": 12.5,
        "solar_radiation": 650.0,
        "eto": 5.2,
    },
}


TELEMETRY_SCHEMA = json.loads(
    (Path(__file__).resolve().parents[3] / "contracts/edge-cloud/v1/telemetry.schema.json")
    .read_text()
)


@pytest.mark.parametrize("endpoint", ["", "/latest"])
@pytest.mark.parametrize("values", ["measured", "null", "zero", "mixed"])
def test_get_reading_matches_v1_contract(
    client, client_headers, node_headers, sample_node, endpoint, values
):
    payload = {"timestamp": SENSOR_PAYLOAD["timestamp"]}
    for category in ("soil", "irrigation", "environmental"):
        payload[category] = {}
        for index, (field, value) in enumerate(SENSOR_PAYLOAD[category].items()):
            if values == "null" or (values == "mixed" and index % 2 == 0):
                value = None
            elif values == "zero" or values == "mixed":
                value = False if field == "active" else 0
            payload[category][field] = value

    created = client.post("/api/v1/readings", json=payload, headers={"X-Event-ID": str(uuid4()), **node_headers})
    assert created.status_code == 201
    response = client.get(
        f"/api/v1/readings{endpoint}",
        params={"irrigation_area_id": sample_node.area_riego_id},
        headers=client_headers,
    )
    assert response.status_code == 200
    if endpoint:
        reading = response.json()
    else:
        assert response.json()["total"] == 1
        reading = response.json()["data"][0]

    # Only the two API wrapper IDs may extend the telemetry contract.
    assert set(reading) == set(TELEMETRY_SCHEMA["required"]) | {
        "id",
        "node_id",
        "timestamp_suspicious",
    }
    assert isinstance(reading["timestamp_suspicious"], bool)
    assert reading["id"] == created.json()["id"]
    assert reading["node_id"] == sample_node.id
    assert reading["timestamp"] == payload["timestamp"]
    assert re.fullmatch(
        TELEMETRY_SCHEMA["properties"]["timestamp"]["pattern"], reading["timestamp"]
    )
    assert datetime.fromisoformat(reading["timestamp"]).utcoffset() == timedelta(0)
    for category in ("soil", "irrigation", "environmental"):
        schema = TELEMETRY_SCHEMA["properties"][category]
        assert isinstance(reading[category], dict)
        assert set(reading[category]) == set(schema["required"])
        assert reading[category] == payload[category]
        for field, value in reading[category].items():
            allowed_types = schema["properties"][field]["type"]
            if value is None:
                assert "null" in allowed_types
            elif "boolean" in allowed_types:
                assert type(value) is bool
            else:
                assert "number" in allowed_types
                assert type(value) in (int, float)


@pytest.mark.parametrize("timestamp", [
    datetime(2026, 4, 1, 10, 0, 0, 123456),
    datetime(2026, 4, 1, 10, 0, 0, 123456, tzinfo=timezone.utc),
    datetime(2026, 4, 1, 4, 0, 0, 123456, tzinfo=timezone(timedelta(hours=-6))),
    datetime(2026, 4, 1, 15, 30, 0, 123456, tzinfo=timezone(timedelta(hours=5, minutes=30))),
])
def test_reading_serializer_normalizes_utc_and_preserves_precision(timestamp):
    reading = Reading(id=1, nodo_id=2, marca_tiempo=timestamp)
    serialized = ReadingResponse.from_reading(reading).model_dump(mode="json")
    assert serialized["timestamp"] == "2026-04-01T10:00:00.123456Z"
    assert reading.marca_tiempo == timestamp


class TestPostReading:
    def test_ingest_reading_valid_gateway_credential(self, client, sample_node, node_headers):
        resp = client.post(
            "/api/v1/readings", json=SENSOR_PAYLOAD, headers={"X-Event-ID": str(uuid4()), **node_headers}
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["node_id"] == sample_node.id

    def test_ingest_reading_invalid_api_key_returns_401(self, client):
        resp = client.post(
            "/api/v1/readings",
            json=SENSOR_PAYLOAD,
            headers={"X-Event-ID": str(uuid4()), **{"X-API-Key": "invalid_key_xyz"}},
        )
        assert resp.status_code == 401

    def test_ingest_reading_missing_gateway_credential_returns_401(self, client):
        resp = client.post("/api/v1/readings", json=SENSOR_PAYLOAD)
        assert resp.status_code == 401

    def test_ingest_reading_missing_timestamp_returns_422(self, client, node_headers):
        payload = {k: v for k, v in SENSOR_PAYLOAD.items() if k != "timestamp"}
        resp = client.post("/api/v1/readings", json=payload, headers={"X-Event-ID": str(uuid4()), **node_headers})
        assert resp.status_code == 422

    def test_ingest_reading_null_optional_fields(self, client, node_headers):
        payload = {
            **SENSOR_PAYLOAD,
            "timestamp": "2026-04-01T11:00:00Z",
            "soil": {
                "conductivity": None,
                "temperature": None,
                "humidity": None,
                "water_potential": None,
            },
            "environmental": {
                "temperature": None,
                "relative_humidity": None,
                "wind_speed": None,
                "solar_radiation": None,
                "eto": None,
            },
        }
        resp = client.post("/api/v1/readings", json=payload, headers={"X-Event-ID": str(uuid4()), **node_headers})
        assert resp.status_code == 201

    def test_ingest_returns_timestamp_and_created_at(self, client, node_headers):
        resp = client.post(
            "/api/v1/readings",
            json={**SENSOR_PAYLOAD, "timestamp": "2026-04-02T09:00:00Z"},
            headers={"X-Event-ID": str(uuid4()), **node_headers},
        )
        data = resp.json()
        assert "timestamp" in data
        assert "created_at" in data


class TestGetReadings:
    def _ingest(self, client, node_headers, timestamp="2026-04-01T10:00:00Z"):
        return client.post(
            "/api/v1/readings",
            json={**SENSOR_PAYLOAD, "timestamp": timestamp},
            headers={"X-Event-ID": str(uuid4()), **node_headers},
        )

    def test_list_readings_requires_auth(self, client, sample_node, node_headers):
        self._ingest(client, node_headers)
        resp = client.get("/api/v1/readings")
        assert resp.status_code == 401

    def test_list_readings_with_auth(
        self, client, sample_node, node_headers, admin_headers
    ):
        self._ingest(client, node_headers)
        resp = client.get("/api/v1/readings", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert "total" in data
        assert "page" in data

    def test_list_readings_pagination(
        self, client, node_headers, admin_headers, sample_node
    ):
        for i in range(3):
            self._ingest(client, node_headers, f"2026-04-0{i+1}T10:00:00Z")
        resp = client.get("/api/v1/readings?page=1&per_page=2", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["data"]) <= 2

    def test_list_filter_by_irrigation_area(
        self, client, node_headers, admin_headers, sample_node, sample_irrigation_area
    ):
        self._ingest(client, node_headers)
        resp = client.get(
            f"/api/v1/readings?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1


class TestGetLatestReading:
    def test_latest_requires_auth(self, client, sample_irrigation_area):
        resp = client.get(
            f"/api/v1/readings/latest?irrigation_area_id={sample_irrigation_area.id}"
        )
        assert resp.status_code == 401

    def test_latest_returns_none_when_no_readings(
        self, client, admin_headers, sample_irrigation_area, sample_node
    ):
        """Área con nodo pero sin lecturas devuelve 200 con null."""
        resp = client.get(
            f"/api/v1/readings/latest?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json() is None

    def test_latest_returns_most_recent(
        self, client, admin_headers, node_headers, sample_node, sample_irrigation_area
    ):
        client.post(
            "/api/v1/readings",
            json={**SENSOR_PAYLOAD, "timestamp": "2026-04-01T08:00:00Z"},
            headers={"X-Event-ID": str(uuid4()), **node_headers},
        )
        client.post(
            "/api/v1/readings",
            json={**SENSOR_PAYLOAD, "timestamp": "2026-04-01T10:00:00Z"},
            headers={"X-Event-ID": str(uuid4()), **node_headers},
        )
        resp = client.get(
            f"/api/v1/readings/latest?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data is not None
        assert "2026-04-01T10:00" in data["timestamp"]


class TestGetPriorityStatus:
    def test_priority_status_requires_auth(self, client, sample_irrigation_area):
        resp = client.get(
            f"/api/v1/readings/priority-status?irrigation_area_id={sample_irrigation_area.id}"
        )
        assert resp.status_code == 401

    def test_priority_status_defaults_to_optimal_without_readings(
        self, client, admin_headers, sample_irrigation_area, sample_node
    ):
        resp = client.get(
            f"/api/v1/readings/priority-status?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["irrigation_area_id"] == sample_irrigation_area.id
        assert data["reading_timestamp"] is None

        by_param = {item["parameter"]: item for item in data["items"]}
        assert by_param["soil.humidity"]["level"] == "optimal"
        assert by_param["irrigation.flow_per_minute"]["level"] == "optimal"
        assert by_param["environmental.eto"]["level"] == "optimal"

    def test_priority_status_uses_latest_reading_and_thresholds(
        self,
        client,
        admin_headers,
        node_headers,
        sample_node,
        sample_irrigation_area,
    ):
        thresholds_payloads = [
            {
                "irrigation_area_id": sample_irrigation_area.id,
                "parameter": "soil.humidity",
                "min_value": 40.0,
                "severity": "critical",
            },
            {
                "irrigation_area_id": sample_irrigation_area.id,
                "parameter": "irrigation.flow_per_minute",
                "max_value": 10.0,
                "severity": "warning",
            },
            {
                "irrigation_area_id": sample_irrigation_area.id,
                "parameter": "environmental.eto",
                "max_value": 4.0,
                "severity": "info",
            },
        ]

        for payload in thresholds_payloads:
            created = client.post(
                "/api/v1/thresholds",
                headers=admin_headers,
                json=payload,
            )
            assert created.status_code == 201

        reading_payload = {
            **SENSOR_PAYLOAD,
            "timestamp": "2026-04-02T10:00:00Z",
            "soil": {
                **SENSOR_PAYLOAD["soil"],
                "humidity": 35.0,
            },
            "irrigation": {
                **SENSOR_PAYLOAD["irrigation"],
                "flow_per_minute": 11.0,
            },
            "environmental": {
                **SENSOR_PAYLOAD["environmental"],
                "eto": 5.0,
            },
        }
        ingest = client.post(
            "/api/v1/readings", json=reading_payload, headers={"X-Event-ID": str(uuid4()), **node_headers}
        )
        assert ingest.status_code == 201

        resp = client.get(
            f"/api/v1/readings/priority-status?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["reading_timestamp"] is not None

        by_param = {item["parameter"]: item for item in data["items"]}

        assert by_param["soil.humidity"]["level"] == "critical"
        assert by_param["soil.humidity"]["breached"] is True

        assert by_param["irrigation.flow_per_minute"]["level"] == "warning"
        assert by_param["irrigation.flow_per_minute"]["breached"] is True

        # "info" severities are represented as warning semaphore level in UI
        assert by_param["environmental.eto"]["level"] == "warning"
        assert by_param["environmental.eto"]["breached"] is True


class TestExportReadings:
    def _ingest_one(self, client, node_headers):
        return client.post(
            "/api/v1/readings", json=SENSOR_PAYLOAD, headers={"X-Event-ID": str(uuid4()), **node_headers}
        )

    def test_export_csv(
        self, client, admin_headers, node_headers, sample_node, sample_irrigation_area
    ):
        self._ingest_one(client, node_headers)
        resp = client.get(
            f"/api/v1/readings/export?format=csv&irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert "text/csv" in resp.headers["content-type"]
        assert b"timestamp" in resp.content

    def test_export_xlsx(
        self, client, admin_headers, node_headers, sample_node, sample_irrigation_area
    ):
        self._ingest_one(client, node_headers)
        resp = client.get(
            f"/api/v1/readings/export?format=xlsx&irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert "spreadsheetml" in resp.headers["content-type"]
        assert resp.content[:2] == b"PK"

    def test_export_pdf(
        self, client, admin_headers, node_headers, sample_node, sample_irrigation_area
    ):
        self._ingest_one(client, node_headers)
        resp = client.get(
            f"/api/v1/readings/export?format=pdf&irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert "pdf" in resp.headers["content-type"]
        assert resp.content[:4] == b"%PDF"

    def test_export_invalid_format_returns_422(
        self, client, admin_headers, sample_irrigation_area
    ):
        resp = client.get(
            f"/api/v1/readings/export?format=json&irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert resp.status_code == 422
