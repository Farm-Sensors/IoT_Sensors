from pydantic import BaseModel, ConfigDict, field_validator

DASHBOARD_CARD_KEYS: tuple[str, ...] = (
    "priority.humidity",
    "priority.flow",
    "priority.eto",
    "irrigation.status",
    "soil.details",
    "soil.chart",
    "environmental.details",
    "sources.external",
)


class DashboardPreferencesUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cards: list[str]

    @field_validator("cards")
    @classmethod
    def _known_cards(cls, value: list[str]) -> list[str]:
        unknown = sorted(set(value) - set(DASHBOARD_CARD_KEYS))
        if unknown:
            raise ValueError(f"Unknown dashboard cards: {', '.join(unknown)}")
        return list(dict.fromkeys(value))


class DashboardPreferencesResponse(BaseModel):
    client_id: int
    cards: list[str] | None
