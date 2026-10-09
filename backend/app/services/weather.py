from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Protocol

from app.schemas.weather import (
    WeatherCoordinates,
    WeatherCurrent,
    WeatherResponse,
    WeatherToday,
)

CURRENT_VARIABLES = (
    "temperature_2m",
    "relative_humidity_2m",
    "wind_speed_10m",
    "shortwave_radiation",
    "weather_code",
)
DAILY_VARIABLES = ("precipitation_sum", "et0_fao_evapotranspiration")


class WeatherDomainError(Exception):
    """Base error safe for translation by a later API layer."""


class WeatherDisabledError(WeatherDomainError):
    pass


class WeatherProviderError(WeatherDomainError):
    pass


class WeatherConfigurationError(WeatherProviderError):
    pass


class WeatherUnavailableError(WeatherDomainError):
    pass


class AsyncHTTPResponse(Protocol):
    status_code: int

    def json(self) -> object: ...


class AsyncHTTPClient(Protocol):
    async def get(
        self, url: str, *, params: dict[str, object], timeout: float
    ) -> AsyncHTTPResponse: ...


def _parse_utc(value: object) -> datetime:
    if not isinstance(value, str):
        raise TypeError("provider timestamp is not a string")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    if parsed.utcoffset() != timedelta(0):
        raise ValueError("provider timestamp is not UTC")
    return parsed.astimezone(UTC)


def _validate_units(payload: dict[str, object]) -> None:
    expected = {
        "current_units": dict(
            zip(CURRENT_VARIABLES, ("°C", "%", "km/h", "W/m²", "wmo code"), strict=True)
        ),
        "daily_units": dict(zip(DAILY_VARIABLES, ("mm", "mm"), strict=True)),
    }
    for section, units in expected.items():
        actual = payload[section]
        if not isinstance(actual, dict) or any(actual.get(key) != unit for key, unit in units.items()):
            raise ValueError(f"provider {section} do not match the weather contract")


class OpenMeteoAdapter:
    def __init__(self, client: AsyncHTTPClient, base_url: str, api_key: str, timeout: float):
        self._client = client
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._timeout = timeout

    async def fetch(
        self, latitude: float, longitude: float, fetched_at: datetime
    ) -> WeatherResponse:
        if not self._base_url:
            raise WeatherConfigurationError("Open-Meteo base URL is missing")
        params: dict[str, object] = {
            "latitude": latitude,
            "longitude": longitude,
            "current": ",".join(CURRENT_VARIABLES),
            "daily": ",".join(DAILY_VARIABLES),
            "timezone": "UTC",
            "temperature_unit": "celsius",
            "wind_speed_unit": "kmh",
            "precipitation_unit": "mm",
            "forecast_days": 1,
        }
        if self._api_key:
            params["apikey"] = self._api_key
        try:
            response = await self._client.get(
                f"{self._base_url}/v1/forecast", params=params, timeout=self._timeout
            )
        except Exception as exc:
            raise WeatherProviderError("Open-Meteo request failed") from exc
        if not 200 <= response.status_code < 300:
            raise WeatherProviderError("Open-Meteo returned a non-success response")
        try:
            payload = response.json()
            if not isinstance(payload, dict):
                raise TypeError("provider payload is not an object")
            _validate_units(payload)
            current = payload["current"]
            daily = payload["daily"]
            if not isinstance(current, dict) or not isinstance(daily, dict):
                raise TypeError("provider weather sections are not objects")
            return WeatherResponse(
                provider="open-meteo",
                coordinates=WeatherCoordinates(
                    requested_latitude=latitude,
                    requested_longitude=longitude,
                    provider_latitude=payload.get("latitude"),
                    provider_longitude=payload.get("longitude"),
                ),
                current=WeatherCurrent(
                    observed_at=_parse_utc(current["time"]),
                    **{key: current[key] for key in CURRENT_VARIABLES},
                ),
                today=WeatherToday(
                    date=daily["time"][0],
                    **{key: daily[key][0] for key in DAILY_VARIABLES},
                ),
                fetched_at=fetched_at,
            )
        except (KeyError, IndexError, ValueError, TypeError) as exc:
            raise WeatherProviderError("Open-Meteo returned malformed weather data") from exc


class WeatherService:
    def __init__(
        self,
        provider: OpenMeteoAdapter,
        *,
        enabled: bool,
        cache_ttl: timedelta = timedelta(minutes=15),
        stale_ttl: timedelta = timedelta(minutes=60),
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ):
        self._provider = provider
        self._enabled = enabled
        self._cache_ttl = cache_ttl
        self._stale_ttl = stale_ttl
        self._clock = clock
        self._cache: dict[tuple[float, float], WeatherResponse] = {}

    async def get_weather(self, latitude: float, longitude: float) -> WeatherResponse:
        if not self._enabled:
            raise WeatherDisabledError("weather integration is disabled")
        now = self._clock()
        key = (latitude, longitude)
        cached = self._cache.get(key)
        age = max(0, int((now - cached.fetched_at).total_seconds())) if cached else 0
        if cached and age < self._cache_ttl.total_seconds():
            return cached.model_copy(update={"cache_state": "fresh", "cache_age_seconds": age})
        try:
            refreshed = await self._provider.fetch(latitude, longitude, now)
        except WeatherConfigurationError:
            raise
        except WeatherProviderError as exc:
            if cached and age <= self._stale_ttl.total_seconds():
                return cached.model_copy(update={"cache_state": "stale", "cache_age_seconds": age})
            raise WeatherUnavailableError("weather data is temporarily unavailable") from exc
        self._cache[key] = refreshed
        return refreshed
