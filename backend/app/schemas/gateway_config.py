from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ConfigurationSlot(BaseModel):
    slot_id: int
    logical_node_id: int
    irrigation_area_id: int
    hardware_profile_code: str | None


class GatewayConfigurationSnapshot(BaseModel):
    gateway_id: int
    property_id: int
    slots: list[ConfigurationSlot]


class BindingMetadata(BaseModel):
    candidate_id: int = Field(ge=1)
    uid: str = Field(min_length=1)
    serial: str = Field(min_length=1)
    submitted_at: datetime
    confirmed_at: datetime | None


class BindingOverlaySlot(BaseModel):
    slot_id: int
    logical_node_id: int
    irrigation_area_id: int
    binding_status: str
    current_binding: BindingMetadata | None = None
    pending_binding: BindingMetadata | None = None


class BindingOverlay(BaseModel):
    slots: list[BindingOverlaySlot]


class GatewayConfigurationResponse(BaseModel):
    configuration_version: int
    bindings_revision: int
    property_id: int
    configuration: GatewayConfigurationSnapshot
    binding_overlay: BindingOverlay
    cloud_status: Literal["inactive", "never_seen", "recently_seen", "stale", "disconnected"]
    edge_status: Literal["pending", "connected", "delayed", "disconnected"]


class BindingCandidateCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slot_id: int = Field(gt=0)
    logical_node_id: int = Field(gt=0)
    irrigation_area_id: int = Field(gt=0)
    uid: str = Field(min_length=1, max_length=128)
    serial: str = Field(min_length=1, max_length=100)


class BindingCandidateResponse(BaseModel):
    candidate_id: int
    slot_id: int
    binding_status: str
    submitted_at: datetime


class BindingConfirmation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slot_id: int = Field(gt=0)
    technician_confirmed_at: str = Field(min_length=20, max_length=40)


class BindingConfirmationResponse(BaseModel):
    candidate_id: int
    slot_id: int
    binding_status: str
    confirmed_at: datetime


class PublishConfigurationResponse(BaseModel):
    gateway_id: int
    property_id: int
    configuration_version: int
    published_at: datetime
