from pydantic import BaseModel, ConfigDict, Field


class GatewayTemplateCopyRequest(BaseModel):
    property_id: int = Field(gt=0)

    model_config = ConfigDict(extra="forbid")
