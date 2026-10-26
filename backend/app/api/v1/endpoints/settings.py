from fastapi import APIRouter, Depends

from app.core.config import settings
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.settings import ModulesResponse

router = APIRouter()


@router.get("/modules", response_model=ModulesResponse)
def get_modules(_current_user: User = Depends(get_current_user)) -> ModulesResponse:
    """Which optional (Fase 2) modules are switched on, so the UI can hide the rest."""
    return ModulesResponse(
        alerts=settings.ALERTS_ENABLED,
        ai_assistant=settings.AI_ASSISTANT_ENABLED,
        ai_reports=settings.AI_REPORTS_ENABLED,
        notifications=settings.NOTIFICATIONS_ENABLED,
    )
