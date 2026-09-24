from datetime import UTC, date, datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from app.models.reading import Reading


# ---------- Input sub-schemas (sensor payload) ----------


class SoilData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    conductivity: float | None
    temperature: float | None
    humidity: float | None
    water_potential: float | None


class IrrigationData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    active: bool | None
    accumulated_liters: float | None
    flow_per_minute: float | None


class EnvironmentalData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    temperature: float | None
    relative_humidity: float | None
    wind_speed: float | None
    solar_radiation: float | None
    eto: float | None


class ReadingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timestamp: datetime
    soil: SoilData
    irrigation: IrrigationData
    environmental: EnvironmentalData

    @field_validator("timestamp", mode="before")
    @classmethod
    def require_explicit_utc_z(cls, value):
        if isinstance(value, datetime):
            if value.tzinfo is None or value.utcoffset() != UTC.utcoffset(value):
                raise ValueError("timestamp must be timezone-aware UTC")
            return value
        if not isinstance(value, str) or not value.endswith("Z"):
            raise ValueError("timestamp must be ISO 8601 UTC ending in Z")
        return value

    @field_validator("timestamp")
    @classmethod
    def normalize_timestamp_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("timestamp must be timezone-aware UTC")
        return value.astimezone(UTC).replace(tzinfo=None)


# ---------- Response sub-schemas (from ORM) ----------


class SoilResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    conductivity: float | None = Field(
        default=None, validation_alias="suelo_conductividad"
    )
    temperature: float | None = Field(
        default=None, validation_alias="suelo_temperatura"
    )
    humidity: float | None = Field(default=None, validation_alias="suelo_humedad")
    water_potential: float | None = Field(
        default=None, validation_alias="suelo_potencial_hidrico"
    )


class IrrigationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    active: bool | None = Field(default=None, validation_alias="riego_activo")
    accumulated_liters: float | None = Field(
        default=None, validation_alias="riego_litros_acumulados"
    )
    flow_per_minute: float | None = Field(
        default=None, validation_alias="riego_flujo_por_minuto"
    )


class EnvironmentalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    temperature: float | None = Field(
        default=None, validation_alias="ambiental_temperatura"
    )
    relative_humidity: float | None = Field(
        default=None, validation_alias="ambiental_humedad_relativa"
    )
    wind_speed: float | None = Field(
        default=None, validation_alias="ambiental_velocidad_viento"
    )
    solar_radiation: float | None = Field(
        default=None, validation_alias="ambiental_radiacion_solar"
    )
    eto: float | None = Field(default=None, validation_alias="ambiental_eto")


# ---------- Top-level response schemas ----------


class ReadingCreateResponse(BaseModel):
    """Returned after a successful sensor POST."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    node_id: int = Field(validation_alias="nodo_id")
    timestamp: datetime = Field(validation_alias="marca_tiempo")
    created_at: datetime = Field(validation_alias="creado_en")


class ReadingResponse(BaseModel):
    """Full reading with nested categories (for history/latest)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    node_id: int = Field(validation_alias="nodo_id")
    timestamp: datetime = Field(validation_alias="marca_tiempo")
    timestamp_suspicious: bool = Field(
        default=False, validation_alias="marca_tiempo_sospechosa"
    )
    soil: SoilResponse
    irrigation: IrrigationResponse
    environmental: EnvironmentalResponse

    @classmethod
    def from_reading(cls, reading: Reading) -> "ReadingResponse":
        """Map the flat storage columns to the nested telemetry contract."""
        return cls(
            id=reading.id,
            nodo_id=reading.nodo_id,
            marca_tiempo=reading.marca_tiempo,
            marca_tiempo_sospechosa=(
                getattr(reading, "marca_tiempo_sospechosa", False) is True
            ),
            soil=SoilResponse.model_validate(reading),
            irrigation=IrrigationResponse.model_validate(reading),
            environmental=EnvironmentalResponse.model_validate(reading),
        )

    @field_serializer("timestamp", when_used="json")
    def serialize_timestamp(self, value: datetime) -> str:
        # MySQL DATETIME stores UTC without timezone information.
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


class ReadingAvailabilityResponse(BaseModel):
    """Availability metadata for date-range pickers."""

    min_date: date | None = None
    max_date: date | None = None
    available_dates: list[date] = Field(default_factory=list)


PriorityParameter = Literal[
    "soil.humidity",
    "irrigation.flow_per_minute",
    "environmental.eto",
]
PrioritySemaphoreLevel = Literal["optimal", "warning", "critical"]
ThresholdSeverity = Literal["info", "warning", "critical"]


class PriorityStatusItem(BaseModel):
    parameter: PriorityParameter
    level: PrioritySemaphoreLevel
    current_value: float | None = None
    breached: bool = False
    threshold_id: int | None = None
    min_value: float | None = None
    max_value: float | None = None
    threshold_severity: ThresholdSeverity | None = None


class PriorityStatusResponse(BaseModel):
    irrigation_area_id: int
    reading_timestamp: datetime | None = None
    items: list[PriorityStatusItem] = Field(default_factory=list)
