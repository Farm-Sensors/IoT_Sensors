from pydantic import BaseModel, Field


class ModulesResponse(BaseModel):
    """Optional modules switched on by server flags (OFF by default)."""

    alerts: bool = Field(
        description="ALERTS_ENABLED: alertas y umbrales (semáforo del dashboard)."
    )
    ai_assistant: bool = Field(
        description="AI_ASSISTANT_ENABLED: asistente IA y su consumo."
    )
    ai_reports: bool = Field(description="AI_REPORTS_ENABLED: reportes IA.")
    notifications: bool = Field(
        description="NOTIFICATIONS_ENABLED: notificaciones externas."
    )
