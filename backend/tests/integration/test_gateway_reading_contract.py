"""Gateway telemetry and NDVI success responses must match the edge-cloud v2 contract."""

import json
import uuid

from tests.helpers.contract import MACHINE_SCHEMA, NDVI_SCHEMA, V2, contract_errors

TELEMETRY_EVENT = json.loads((V2 / "fixtures/telemetry.valid.json").read_text())
NDVI_EVENT = json.loads((V2 / "fixtures/ndvi.valid.json").read_text())


def test_reading_created_and_replayed_responses_match_contract(client, gateway_headers):
    headers = gateway_headers | {"X-Event-ID": str(uuid.uuid4())}
    reading_response = MACHINE_SCHEMA["$defs"]["readingResponse"]

    created = client.post("/api/v1/readings", json=TELEMETRY_EVENT, headers=headers)
    assert created.status_code == 201
    assert contract_errors(created.json(), reading_response) == []
    assert created.json()["timestamp"] == TELEMETRY_EVENT["timestamp"]

    replayed = client.post("/api/v1/readings", json=TELEMETRY_EVENT, headers=headers)
    assert replayed.status_code == 200
    assert contract_errors(replayed.json(), reading_response) == []
    assert replayed.json() == created.json()


def test_ndvi_created_and_replayed_responses_match_contract(
    client, gateway_headers, sample_irrigation_area
):
    headers = {"X-API-Key": gateway_headers["X-API-Key"]}
    event = {**NDVI_EVENT, "irrigation_area_id": sample_irrigation_area.id}

    created = client.post("/api/v1/ndvi-snapshots", json=event, headers=headers)
    assert created.status_code == 201
    assert contract_errors(created.json(), NDVI_SCHEMA) == []

    replayed = client.post("/api/v1/ndvi-snapshots", json=event, headers=headers)
    assert replayed.status_code == 200
    assert contract_errors(replayed.json(), NDVI_SCHEMA) == []
    assert replayed.json() == created.json()
