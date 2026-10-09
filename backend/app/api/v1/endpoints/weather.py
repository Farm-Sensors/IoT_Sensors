from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import timedelta
from math import isfinite

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.authz import get_client_area_ids
from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.irrigation_area import IrrigationArea
from app.models.property import Property
from app.models.user import User
from app.schemas.weather import WeatherResponse
from app.services.weather import (
    OpenMeteoAdapter,
    WeatherConfigurationError,
    WeatherDisabledError,
    WeatherService,
    WeatherUnavailableError,
)

_weather_service: WeatherService | None = None


def get_weather_service() -> WeatherService:
    if _weather_service is None:
        raise RuntimeError("weather service has not been initialized")
    return _weather_service


def reset_weather_service_dependency() -> None:
    global _weather_service
    _weather_service = None


@asynccontextmanager
async def _weather_lifespan(_app) -> AsyncIterator[None]:
    global _weather_service
    client = httpx.AsyncClient(timeout=settings.OPEN_METEO_HTTP_TIMEOUT_SECONDS)
    adapter = OpenMeteoAdapter(
        client,
        settings.OPEN_METEO_BASE_URL,
        settings.OPEN_METEO_API_KEY,
        settings.OPEN_METEO_HTTP_TIMEOUT_SECONDS,
    )
    service = WeatherService(
        adapter,
        enabled=settings.OPEN_METEO_ENABLED,
        cache_ttl=timedelta(minutes=settings.OPEN_METEO_CACHE_TTL_MINUTES),
        stale_ttl=timedelta(minutes=settings.OPEN_METEO_STALE_TTL_MINUTES),
    )
    _weather_service = service
    try:
        yield
    finally:
        await client.aclose()
        if _weather_service is service:
            reset_weather_service_dependency()


router = APIRouter(lifespan=_weather_lifespan)


def _get_area(user: User, db: Session, area_id: int) -> IrrigationArea:
    query = select(IrrigationArea).where(
        IrrigationArea.id == area_id,
        IrrigationArea.eliminado_en.is_(None),
    )
    if user.rol != "admin":
        query = query.where(IrrigationArea.id.in_(get_client_area_ids(user, db) or []))
    area = db.execute(query).scalar_one_or_none()
    if area is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Irrigation area not found")
    return area


def _get_coordinates(db: Session, area: IrrigationArea) -> tuple[float, float]:
    """Resolve the property's reference location (reported by the gateway)."""
    prop = db.get(Property, area.predio_id)
    try:
        latitude = float(prop.latitud) if prop and prop.latitud is not None else None
        longitude = float(prop.longitud) if prop and prop.longitud is not None else None
    except (TypeError, ValueError):
        latitude = longitude = None
    if (
        latitude is None
        or longitude is None
        or not isfinite(latitude)
        or not isfinite(longitude)
        or not -90 <= latitude <= 90
        or not -180 <= longitude <= 180
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Property has no reference location yet",
        )
    return latitude, longitude


@router.get("/current", response_model=WeatherResponse)
async def get_current_weather(
    irrigation_area_id: int = Query(..., ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    weather_service: WeatherService = Depends(get_weather_service),
):
    area = _get_area(current_user, db, irrigation_area_id)
    latitude, longitude = _get_coordinates(db, area)
    try:
        return await weather_service.get_weather(latitude, longitude)
    except (WeatherDisabledError, WeatherConfigurationError) as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Weather service unavailable") from exc
    except WeatherUnavailableError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Weather provider unavailable") from exc
