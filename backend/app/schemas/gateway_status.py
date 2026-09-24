from datetime import datetime

from pydantic import BaseModel


class GatewaySlotStatus(BaseModel):
    logical_node_id: int
    irrigation_area_id: int
    binding_status: str
    latest_reading_at: datetime | None = None
    bound_uid: str | None = None
    bound_serial: str | None = None

    model_config = {"extra": "ignore"}


class GatewayStatusResponse(BaseModel):
    gateway_id: int
    status: str
    edge_status: str
    last_heartbeat_at: datetime | None
    config_version: int
    slots: list[GatewaySlotStatus]
