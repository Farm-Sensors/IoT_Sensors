from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class TemplateSlotDefinition(BaseModel):
    area_name: str = Field(min_length=1, max_length=150)
    hardware_profile_code: str | None = Field(default=None, max_length=64)

    model_config = ConfigDict(extra="forbid")

    @field_validator("area_name", mode="before")
    @classmethod
    def strip_area_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("hardware_profile_code", mode="before")
    @classmethod
    def normalize_profile_code(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value


class GatewayTemplateDefinition(BaseModel):
    slots: list[TemplateSlotDefinition] = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def require_unique_area_selectors(self):
        names = [slot.area_name.casefold() for slot in self.slots]
        if len(names) != len(set(names)):
            raise ValueError("Template area selectors must be unique")
        return self


class GatewayTemplateCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    definition: GatewayTemplateDefinition

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class GatewayTemplateVersionCreate(BaseModel):
    definition: GatewayTemplateDefinition


class GatewayTemplateSummaryResponse(BaseModel):
    id: int
    name: str = Field(validation_alias="nombre")
    status: str = Field(validation_alias="estado")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class GatewayTemplateVersionResponse(BaseModel):
    id: int
    version: int
    status: str = Field(validation_alias="estado")
    definition: GatewayTemplateDefinition = Field(validation_alias="definicion")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class GatewayTemplateDetailResponse(GatewayTemplateSummaryResponse):
    versions: list[GatewayTemplateVersionResponse]
