from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field, field_serializer


class ActivationReferenceResponse(BaseModel):
    activation_reference: str
    expires_at: datetime

    @field_serializer("expires_at")
    def serialize_expiry(self, value: datetime) -> str:
        utc_value = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
        return utc_value.isoformat().replace("+00:00", "Z")


class GatewayActivationRequest(BaseModel):
    activation_reference: str

    model_config = ConfigDict(extra="forbid")


class GatewayCredentialResponse(BaseModel):
    gateway_id: int
    property_id: int
    credential: str = Field(min_length=8)
