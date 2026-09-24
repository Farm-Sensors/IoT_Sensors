from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class GatewaySlotCreate(BaseModel):
    irrigation_area_id: int = Field(gt=0)
    hardware_profile_id: int | None = Field(default=None, gt=0)


class GatewayProvision(BaseModel):
    property_id: int = Field(gt=0)
    slots: list[GatewaySlotCreate]


class GatewayResponse(BaseModel):
    id: int
    property_id: int = Field(validation_alias="predio_id")
    status: str = Field(validation_alias="estado")
    configuration_version: int = Field(validation_alias="config_version_activa")
    bindings_revision: int
    activated_at: datetime | None = Field(default=None, validation_alias="activado_en")
    revoked_at: datetime | None = Field(default=None, validation_alias="revocado_en")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class GatewaySlotResponse(BaseModel):
    id: int
    irrigation_area_id: int = Field(validation_alias="area_riego_id")
    logical_node_id: int = Field(validation_alias="nodo_id")
    hardware_profile_id: int | None = Field(default=None, validation_alias="perfil_hardware_id")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class GatewayDetailResponse(GatewayResponse):
    slots: list[GatewaySlotResponse]
