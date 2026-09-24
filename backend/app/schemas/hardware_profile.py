from pydantic import BaseModel, ConfigDict, Field, field_validator


class HardwareProfileCreate(BaseModel):
    code: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=2, max_length=150)

    @field_validator("code", mode="before")
    @classmethod
    def normalize_code(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class HardwareProfileUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=64)
    name: str | None = Field(default=None, min_length=2, max_length=150)
    active: bool | None = None

    @field_validator("code", mode="before")
    @classmethod
    def normalize_code(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class HardwareProfileResponse(BaseModel):
    id: int
    code: str = Field(validation_alias="codigo")
    name: str = Field(validation_alias="nombre")
    active: bool = Field(validation_alias="activo")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
