from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PropertyCreate(BaseModel):
    client_id: int
    name: str
    location: str | None = None


class PropertyUpdate(BaseModel):
    name: str | None = None
    location: str | None = None


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
