import json
from pathlib import Path

import pytest

from app.models import Client, IrrigationArea, NDVILatestSnapshot, Property, User
from app.schemas.ndvi import NDVIEvent
from app.services import ndvi as ndvi_service

FIXTURE = Path(__file__).parents[3] / "contracts/edge-cloud/v1/fixtures/ndvi.valid.json"
VALID_EVENT = json.loads(FIXTURE.read_text())
PATH = "/api/v1/ndvi-snapshots"


def _event(area_id: int, **overrides) -> dict:
    return {**VALID_EVENT, "irrigation_area_id": area_id, **overrides}


def _foreign_area(db, crop_type) -> IrrigationArea:
    user = User(
        correo="foreign-ndvi@test.com",
        contrasena_hash="unused",
        nombre_completo="Foreign NDVI Client",
        rol="cliente",
        activo=True,
    )
    db.add(user)
    db.flush([user])
    foreign_client = Client(usuario_id=user.id, nombre_empresa="Foreign Farm")
    db.add(foreign_client)
    db.flush([foreign_client])
    prop = Property(cliente_id=foreign_client.id, nombre="Foreign Property")
    db.add(prop)
    db.flush([prop])
    area = IrrigationArea(
        predio_id=prop.id,
        tipo_cultivo_id=crop_type.id,
        nombre="Foreign Area",
    )
    db.add(area)
    db.flush([area])
    return area


def test_node_creates_and_replaces_latest_snapshot(
    client, legacy_node_headers, sample_node, sample_irrigation_area
):
    created_event = _event(sample_irrigation_area.id)
    created = client.post(PATH, json=created_event, headers=legacy_node_headers)

    assert created.status_code == 201
    assert created.headers["X-NDVI-Write-Result"] == "created"
    assert created.json() == created_event

    replacement = _event(
        sample_irrigation_area.id,
        ndvi=-0.42,
        provider="Replacement provider",
        scene_id="newer-scene",
        scene_observed_at="2026-09-15T17:39:09.123456790Z",
        cloud_cover_percent=99.25,
    )
    replaced = client.post(PATH, json=replacement, headers=legacy_node_headers)

    assert replaced.status_code == 200
    assert replaced.headers["X-NDVI-Write-Result"] == "replaced"
    assert replaced.json() == replacement


def test_identical_replay_returns_current_snapshot(
    client, db, legacy_node_headers, sample_irrigation_area
):
    event = _event(sample_irrigation_area.id)
    client.post(PATH, json=event, headers=legacy_node_headers)

    replay = client.post(PATH, json=event, headers=legacy_node_headers)

    assert replay.status_code == 200
    assert replay.headers["X-NDVI-Write-Result"] == "replayed"
    assert replay.json() == event
    assert db.query(NDVILatestSnapshot).count() == 1


@pytest.mark.parametrize(
    ("headers", "expected_status"),
    [
        ({}, 422),
        ({"X-API-Key": "invalid-key"}, 401),
    ],
)
def test_ingestion_rejects_missing_or_wrong_api_key(client, headers, expected_status):
    response = client.post(PATH, json=_event(1), headers=headers)
    assert response.status_code == expected_status


def test_node_cannot_write_another_area(client, db, legacy_node_headers, sample_irrigation_area):
    response = client.post(
        PATH,
        json=_event(sample_irrigation_area.id + 1),
        headers=legacy_node_headers,
    )

    assert response.status_code == 403
    assert db.query(NDVILatestSnapshot).count() == 0


def test_area_race_returns_404_without_commit_or_mutation(
    client, db, legacy_node_headers, sample_irrigation_area, monkeypatch
):
    def raise_missing_area(*_args):
        raise ndvi_service.NDVIAreaMismatchError("area disappeared")

    monkeypatch.setattr(ndvi_service, "store_latest_ndvi_with_result", raise_missing_area)
    monkeypatch.setattr(db, "commit", lambda: pytest.fail("endpoint committed"))

    response = client.post(
        PATH,
        json=_event(sample_irrigation_area.id),
        headers=legacy_node_headers,
    )

    assert response.status_code == 404
    assert response.json() == {
        "detail": f"Irrigation area with id {sample_irrigation_area.id} not found"
    }
    assert db.query(NDVILatestSnapshot).count() == 0


@pytest.mark.parametrize(
    "overrides",
    [
        {"ndvi": 0.64},
        {
            "scene_id": "older-scene",
            "scene_observed_at": "2026-09-14T17:39:09Z",
        },
        {"scene_id": "equal-time-scene"},
    ],
)
def test_conflicts_do_not_mutate_snapshot(
    client, db, legacy_node_headers, sample_irrigation_area, overrides
):
    current = _event(sample_irrigation_area.id)
    client.post(PATH, json=current, headers=legacy_node_headers)

    conflict = client.post(
        PATH,
        json=_event(sample_irrigation_area.id, **overrides),
        headers=legacy_node_headers,
    )

    assert conflict.status_code == 409
    db.expire_all()
    snapshot = db.get(NDVILatestSnapshot, sample_irrigation_area.id)
    assert snapshot.escena_id == current["scene_id"]
    assert snapshot.ndvi == current["ndvi"]


def test_admin_and_owner_can_read_latest(
    client,
    legacy_node_headers,
    admin_headers,
    client_headers,
    sample_irrigation_area,
):
    event = _event(sample_irrigation_area.id)
    client.post(PATH, json=event, headers=legacy_node_headers)

    for headers in (admin_headers, client_headers):
        response = client.get(
            f"{PATH}/latest?irrigation_area_id={sample_irrigation_area.id}",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json() == event


def test_read_hides_foreign_and_nonexistent_areas(
    client,
    db,
    admin_headers,
    client_headers,
    sample_crop_type,
    sample_irrigation_area,
):
    own_missing = client.get(
        f"{PATH}/latest?irrigation_area_id={sample_irrigation_area.id}",
        headers=client_headers,
    )
    assert own_missing.status_code == 404

    foreign_area = _foreign_area(db, sample_crop_type)
    event = NDVIEvent.model_validate(_event(foreign_area.id))
    ndvi_service.store_latest_ndvi(db, foreign_area, event)
    db.commit()

    foreign = client.get(
        f"{PATH}/latest?irrigation_area_id={foreign_area.id}",
        headers=client_headers,
    )
    nonexistent = client.get(
        f"{PATH}/latest?irrigation_area_id=99999",
        headers=client_headers,
    )
    admin_missing = client.get(
        f"{PATH}/latest?irrigation_area_id=99999",
        headers=admin_headers,
    )

    assert foreign.status_code == nonexistent.status_code == 403
    assert admin_missing.status_code == 404


def test_read_requires_user_authentication(client, sample_irrigation_area):
    response = client.get(f"{PATH}/latest?irrigation_area_id={sample_irrigation_area.id}")
    assert response.status_code == 401


def test_ndvi_is_absent_from_reading_contracts_and_routes(client):
    openapi = client.get("/api/v1/openapi.json").json()
    reading_schemas = {
        name: schema
        for name, schema in openapi["components"]["schemas"].items()
        if name.startswith("Reading")
    }

    assert '"ndvi"' not in json.dumps(reading_schemas).lower()
    assert f"{PATH}/latest" in openapi["paths"]
    assert all("ndvi" not in path for path in openapi["paths"] if "/readings" in path)
