from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UpdateAuthorizationCreate(BaseModel):
    image_version: str = Field(min_length=1, max_length=128)
    image_digest: str = Field(min_length=1, max_length=128)
    expires_at: datetime


class UpdateAuthorizationResponse(BaseModel):
    authorization_id: str
    image_version: str
    image_digest: str
    expires_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UpdateConfirmationCreate(BaseModel):
    authorization_id: str = Field(min_length=1, max_length=64)
    image_version: str = Field(min_length=1, max_length=128)
    image_digest: str = Field(min_length=1, max_length=128)
    technician_confirmed_at: datetime
    result: str = Field(pattern="^confirmed$")


class UpdateConfirmationResponse(BaseModel):
    authorization_id: str
    image_version: str
    image_digest: str
    result: str
    recorded_at: datetime
