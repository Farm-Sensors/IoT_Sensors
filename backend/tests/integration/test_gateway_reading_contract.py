"""Gateway telemetry and NDVI success responses must match the edge-cloud v2 contract."""

import json
import re
import uuid
from pathlib import Path

V2 = Path(__file__).resolve().parents[3] / "contracts/edge-cloud/v2"
MACHINE_SCHEMA = json.loads((V2 / "machine.schema.json").read_text())
NDVI_SCHEMA = json.loads((V2 / "ndvi.schema.json").read_text())
TELEMETRY_EVENT = json.loads((V2 / "fixtures/telemetry.valid.json").read_text())
NDVI_EVENT = json.loads((V2 / "fixtures/ndvi.valid.json").read_text())

_SUPPORTED_KEYWORDS = {
    "$schema", "title", "type", "additionalProperties", "required", "properties", "enum",
    "const", "$ref", "anyOf", "minimum", "maximum", "minLength", "items", "pattern", "format",
}
_TYPE_CHECKS = {
    "object": lambda v: isinstance(v, dict),
    "array": lambda v: isinstance(v, list),
    "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
    "number": lambda v: isinstance(v, int | float) and not isinstance(v, bool),
    "string": lambda v: isinstance(v, str),
    "null": lambda v: v is None,
}


def _contract_errors(value, schema, path="$"):
    """Validate the keyword subset used by the v2 schemas (jsonschema is not a backend dep)."""
    unsupported = set(schema) - _SUPPORTED_KEYWORDS
    assert not unsupported, f"validator does not support {unsupported} at {path}"
    if "$ref" in schema:
        name = schema["$ref"].removeprefix("#/$defs/")
        return _contract_errors(value, MACHINE_SCHEMA["$defs"][name], path)
    if "anyOf" in schema:
        if any(not _contract_errors(value, option, path) for option in schema["anyOf"]):
            return []
        return [f"{path}: matches no anyOf branch"]
    errors = []
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: {value!r} not in {schema['enum']}")
    if "const" in schema and value != schema["const"]:
        errors.append(f"{path}: {value!r} != {schema['const']!r}")
    expected = schema.get("type")
    if expected is not None and not _TYPE_CHECKS[expected](value):
        return [f"{path}: expected {expected}, got {value!r}"]
    if expected in {"integer", "number"}:
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{path}: {value} < {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            errors.append(f"{path}: {value} > {schema['maximum']}")
    if expected == "string" or (expected is None and isinstance(value, str)):
        if len(value) < schema.get("minLength", 0):
            errors.append(f"{path}: shorter than minLength")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errors.append(f"{path}: {value!r} does not match pattern")
    if expected == "object":
        properties = schema.get("properties", {})
        errors += [f"{path}: missing {key}" for key in schema.get("required", []) if key not in value]
        if schema.get("additionalProperties") is False:
            errors += [f"{path}: unexpected {key}" for key in value if key not in properties]
        for key, item in value.items():
            if key in properties:
                errors += _contract_errors(item, properties[key], f"{path}.{key}")
    if expected == "array" and "items" in schema:
        for index, item in enumerate(value):
            errors += _contract_errors(item, schema["items"], f"{path}[{index}]")
    return errors


def test_reading_created_and_replayed_responses_match_contract(client, gateway_headers):
    headers = gateway_headers | {"X-Event-ID": str(uuid.uuid4())}
    reading_response = MACHINE_SCHEMA["$defs"]["readingResponse"]

    created = client.post("/api/v1/readings", json=TELEMETRY_EVENT, headers=headers)
    assert created.status_code == 201
    assert _contract_errors(created.json(), reading_response) == []
    assert created.json()["timestamp"] == TELEMETRY_EVENT["timestamp"]

    replayed = client.post("/api/v1/readings", json=TELEMETRY_EVENT, headers=headers)
    assert replayed.status_code == 200
    assert _contract_errors(replayed.json(), reading_response) == []
    assert replayed.json() == created.json()


def test_ndvi_created_and_replayed_responses_match_contract(
    client, gateway_headers, sample_irrigation_area
):
    headers = {"X-API-Key": gateway_headers["X-API-Key"]}
    event = {**NDVI_EVENT, "irrigation_area_id": sample_irrigation_area.id}

    created = client.post("/api/v1/ndvi-snapshots", json=event, headers=headers)
    assert created.status_code == 201
    assert _contract_errors(created.json(), NDVI_SCHEMA) == []

    replayed = client.post("/api/v1/ndvi-snapshots", json=event, headers=headers)
    assert replayed.status_code == 200
    assert _contract_errors(replayed.json(), NDVI_SCHEMA) == []
    assert replayed.json() == created.json()
