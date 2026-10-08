"""Schemas for gateway device-authorization pairing (RFC 8628 style).

Machine requests/responses follow the v2 contract; the admin bodies are shared
between the verification page and the API. No schema ever carries a raw
``device_code`` back to the admin, and ``user_code`` is only accepted as input.
"""

from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field, field_serializer

DEVICE_FIELD_MAX = 64
USER_CODE_MAX = 16


def _serialize_utc(value: datetime) -> str:
    utc_value = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
    return utc_value.isoformat().replace("+00:00", "Z")


# --- Machine operations -----------------------------------------------------


class PairingDeviceInfo(BaseModel):
    hostname: str | None = Field(default=None, max_length=DEVICE_FIELD_MAX)
    model: str | None = Field(default=None, max_length=DEVICE_FIELD_MAX)
    agent_version: str | None = Field(default=None, max_length=DEVICE_FIELD_MAX)

    model_config = ConfigDict(extra="forbid")


class PairingStartRequest(BaseModel):
    device: PairingDeviceInfo | None = None

    model_config = ConfigDict(extra="forbid")


class PairingStartResponse(BaseModel):
    device_code: str
    user_code: str
    verification_uri: str
    verification_uri_complete: str
    expires_in: int
    interval: int


class PairingTokenRequest(BaseModel):
    device_code: str = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")


# --- Admin operations -------------------------------------------------------


class PairingLookupRequest(BaseModel):
    user_code: str = Field(min_length=1, max_length=USER_CODE_MAX)

    model_config = ConfigDict(extra="forbid")


class PairingDeviceResponse(BaseModel):
    hostname: str | None = None
    model: str | None = None
    agent_version: str | None = None


class PairingLookupResponse(BaseModel):
    session_id: str
    user_code: str
    status: str
    requested_at: datetime
    expires_at: datetime
    device: PairingDeviceResponse
    source_network: str | None = None

    @field_serializer("requested_at", "expires_at")
    def serialize_timestamps(self, value: datetime) -> str:
        return _serialize_utc(value)


class PairingApproveRequest(BaseModel):
    user_code: str = Field(min_length=1, max_length=USER_CODE_MAX)
    gateway_id: int = Field(gt=0)
    confirm: bool
    replace_credential: bool = False

    model_config = ConfigDict(extra="forbid")


class PairingApproveResponse(BaseModel):
    session_id: str
    status: str
    gateway_id: int
    property_id: int


class PairingDenyRequest(BaseModel):
    user_code: str = Field(min_length=1, max_length=USER_CODE_MAX)

    model_config = ConfigDict(extra="forbid")


class PairingDenyResponse(BaseModel):
    session_id: str
    status: str
