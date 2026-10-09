from datetime import UTC, date, datetime
from decimal import Decimal

import pytest

from app.api.v1.endpoints.weather import get_weather_service
from app.main import app
from app.models import Client, IrrigationArea, Property
from app.schemas.weather import (
    WeatherCoordinates,
    WeatherCurrent,
    WeatherResponse,
    WeatherToday,
)
from app.services.weather import (
    WeatherConfigurationError,
    WeatherUnavailableError,
)

PATH = "/api/v1/weather/current"


def _weather(cache_state="fresh"):
    return WeatherResponse(
        provider="open-meteo",
        coordinates=WeatherCoordinates(
            requested_latitude=28.632,
            requested_longitude=-106.0691,
            provider_latitude=28.625,
            provider_longitude=-106.0625,
        ),
        current=WeatherCurrent(
            observed_at=datetime(2026, 9, 15, 16, 0, tzinfo=UTC),
            temperature_2m=27.4,
            relative_humidity_2m=41.0,
            wind_speed_10m=12.2,
            shortwave_radiation=612.0,
            weather_code=2,
        ),
        today=WeatherToday(
            date=date(2026, 9, 15),
            precipitation_sum=1.7,
            et0_fao_evapotranspiration=5.3,
        ),
        fetched_at=datetime(2026, 9, 15, 16, 5, tzinfo=UTC),
        cache_state=cache_state,
        cache_age_seconds=960 if cache_state == "stale" else 0,
    )


class _Service:
    def __init__(self, response=None, error=None):
        self.response = response or _weather()
        self.error = error
        self.calls = []

    async def get_weather(self, latitude, longitude):
        self.calls.append((latitude, longitude))
        if self.error:
            raise self.error
        return self.response


def _inject(service):
    app.dependency_overrides[get_weather_service] = lambda: service


def _get(client, headers, area_id):
    return client.get(f"{PATH}?irrigation_area_id={area_id}", headers=headers)


def test_admin_gets_weather_from_property_location(
    client, admin_headers, sample_irrigation_area, sample_property
):
    service = _Service()
    _inject(service)

    response = _get(client, admin_headers, sample_irrigation_area.id)

    assert response.status_code == 200
    assert response.json()["provider"] == "open-meteo"
    assert response.json()["coordinates"]["requested_latitude"] == 28.632
    assert service.calls == [(28.632, -106.0691)]


def test_property_location_wins_over_node_gps(
    client, db, admin_headers, sample_irrigation_area, sample_node
):
    sample_node.latitud = 10.0
    sample_node.longitud = 10.0
    db.flush()
    service = _Service()
    _inject(service)

    response = _get(client, admin_headers, sample_irrigation_area.id)

    assert response.status_code == 200
    assert service.calls == [(28.632, -106.0691)]


def test_client_gets_weather_for_owned_area(
    client, client_headers, sample_irrigation_area, sample_property
):
    service = _Service()
    _inject(service)

    response = _get(client, client_headers, sample_irrigation_area.id)

    assert response.status_code == 200
    assert service.calls == [(28.632, -106.0691)]


def test_foreign_missing_and_inactive_areas_are_hidden(
    client,
    db,
    client_headers,
    admin_user,
    sample_crop_type,
    sample_irrigation_area,
):
    foreign_client = Client(usuario_id=admin_user.id, nombre_empresa="Foreign")
    db.add(foreign_client)
    db.flush([foreign_client])
    foreign_property = Property(cliente_id=foreign_client.id, nombre="Foreign")
    db.add(foreign_property)
    db.flush([foreign_property])
    foreign_area = IrrigationArea(
        predio_id=foreign_property.id,
        tipo_cultivo_id=sample_crop_type.id,
        nombre="Foreign",
    )
    db.add(foreign_area)
    db.flush([foreign_area])
    sample_irrigation_area.eliminado_en = datetime(2026, 9, 15)
    db.flush([sample_irrigation_area])
    service = _Service()
    _inject(service)

    responses = [
        _get(client, client_headers, foreign_area.id),
        _get(client, client_headers, 99999),
        _get(client, client_headers, sample_irrigation_area.id),
    ]

    assert [response.status_code for response in responses] == [404, 404, 404]
    assert len({response.json()["detail"] for response in responses}) == 1
    assert service.calls == []


@pytest.mark.parametrize("property_state", ["missing", "out-of-range"])
def test_property_without_usable_location_returns_conflict(
    client, db, admin_headers, sample_irrigation_area, sample_property, sample_node, property_state
):
    if property_state == "missing":
        sample_property.latitud = None
        sample_property.longitud = None
    else:
        sample_property.latitud = Decimal("99.0")
    db.flush()
    service = _Service()
    _inject(service)

    response = _get(client, admin_headers, sample_irrigation_area.id)

    assert response.status_code == 409
    assert response.json()["detail"] == "Property has no reference location yet"
    assert service.calls == []


def test_default_disabled_runtime_service_returns_503(
    client, admin_headers, sample_irrigation_area, sample_property
):
    first = get_weather_service()
    response = _get(client, admin_headers, sample_irrigation_area.id)

    assert response.status_code == 503
    assert get_weather_service() is first


@pytest.mark.parametrize(
    ("error", "expected_status"),
    [
        (WeatherConfigurationError("missing provider config"), 503),
        (WeatherUnavailableError("upstream unavailable"), 502),
    ],
)
def test_weather_failures_map_to_gateway_statuses(
    client, admin_headers, sample_irrigation_area, sample_property, error, expected_status
):
    _inject(_Service(error=error))

    response = _get(client, admin_headers, sample_irrigation_area.id)

    assert response.status_code == expected_status
    assert "provider config" not in response.text


def test_stale_fallback_remains_successful(
    client, admin_headers, sample_irrigation_area, sample_property
):
    _inject(_Service(response=_weather("stale")))

    response = _get(client, admin_headers, sample_irrigation_area.id)

    assert response.status_code == 200
    assert response.json()["cache_state"] == "stale"
    assert response.json()["cache_age_seconds"] == 960


def test_weather_requires_jwt(client, sample_irrigation_area):
    response = _get(client, {}, sample_irrigation_area.id)
    assert response.status_code == 401
