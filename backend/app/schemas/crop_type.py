from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

# La foto solo puede venir de Wikimedia (el servidor no guarda imágenes ni enlaza sitios arbitrarios).
_PHOTO_HOSTS = ("https://upload.wikimedia.org/", "https://thumb.wikimedia.org/")
_PAGE_HOSTS = ("https://commons.wikimedia.org/",)


def _only_from(value: str | None, prefixes: tuple[str, ...], label: str) -> str | None:
    if value is None or value == "":
        return None
    if not value.startswith(prefixes) or len(value) > 500:
        raise ValueError(f"{label} debe ser una dirección de Wikimedia")
    return value


class _PhotoFields(BaseModel):
    """Foto opcional del cultivo: dirección de la miniatura, atribución y página del archivo."""

    photo_url: str | None = None
    photo_credit: str | None = Field(default=None, max_length=255)
    photo_page: str | None = None

    @field_validator("photo_url")
    @classmethod
    def _photo_url(cls, value: str | None) -> str | None:
        return _only_from(value, _PHOTO_HOSTS, "photo_url")

    @field_validator("photo_page")
    @classmethod
    def _photo_page(cls, value: str | None) -> str | None:
        return _only_from(value, _PAGE_HOSTS, "photo_page")


class CropTypeCreate(_PhotoFields):
    name: str
    description: str | None = None


class CropTypeUpdate(_PhotoFields):
    name: str | None = None
    description: str | None = None


class CropTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str = Field(validation_alias="nombre")
    description: str | None = Field(default=None, validation_alias="descripcion")
    photo_url: str | None = Field(default=None, validation_alias="foto_url")
    photo_credit: str | None = Field(default=None, validation_alias="foto_credito")
    photo_page: str | None = Field(default=None, validation_alias="foto_pagina")
    created_at: datetime = Field(validation_alias="creado_en")
    updated_at: datetime = Field(validation_alias="actualizado_en")


class CropTypeBrief(BaseModel):
    """Minimal crop type info for embedding in other responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str = Field(validation_alias="nombre")
