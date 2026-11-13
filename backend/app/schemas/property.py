from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PropertyCreate(BaseModel):
    client_id: int
    name: str
    location: str | None = None


class PropertyUpdate(BaseModel):
    name: str | None = None
    location: str | None = None
    # Reference location captured by an admin (the equipo also reports it with `location`).
    # Both or neither: send both `null` to clear it.
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def _latitude_with_longitude(self) -> "PropertyUpdate":
        lat_set = "latitude" in self.model_fields_set
        lon_set = "longitude" in self.model_fields_set
        if lat_set != lon_set or (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude go together")
        return self


class PropertyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int = Field(validation_alias="cliente_id")
    name: str = Field(validation_alias="nombre")
    location: str | None = Field(default=None, validation_alias="ubicacion")
    latitude: float | None = Field(default=None, validation_alias="latitud")
    longitude: float | None = Field(default=None, validation_alias="longitud")
    created_at: datetime = Field(validation_alias="creado_en")
    updated_at: datetime = Field(validation_alias="actualizado_en")
