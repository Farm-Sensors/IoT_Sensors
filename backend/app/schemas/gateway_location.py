from pydantic import BaseModel, ConfigDict, Field


class GatewayLocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)


class GatewayLocationCreate(BaseModel):
    """Body of the v2 ``location`` operation: the device reports where it is installed."""

    model_config = ConfigDict(extra="forbid")

    location: GatewayLocation
