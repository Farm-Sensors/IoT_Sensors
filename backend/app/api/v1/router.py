from fastapi import APIRouter

from app.api.v1.endpoints import (
    ai_assistant,
    ai_reports,
    alerts,
    audit_logs,
    auth,
    clients,
    crop_cycles,
    crop_types,
    gateway_template_copy,
    irrigation_areas,
    ndvi_snapshots,
    nodes,
    notification_preferences,
    properties,
    readings,
    thresholds,
    users,
    weather,
)

api_v1_router = APIRouter()

api_v1_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_v1_router.include_router(users.router, prefix="/users", tags=["Users"])
api_v1_router.include_router(clients.router, prefix="/clients", tags=["Clients"])
api_v1_router.include_router(
    properties.router, prefix="/properties", tags=["Properties"]
)
api_v1_router.include_router(
    crop_types.router, prefix="/crop-types", tags=["Crop Types"]
)
api_v1_router.include_router(
    gateway_template_copy.router,
    prefix="/gateway-templates",
    tags=["Gateway Templates"],
)
api_v1_router.include_router(
    irrigation_areas.router, prefix="/irrigation-areas", tags=["Irrigation Areas"]
)
api_v1_router.include_router(
    crop_cycles.router, prefix="/crop-cycles", tags=["Crop Cycles"]
)
api_v1_router.include_router(nodes.router, prefix="/nodes", tags=["Nodes"])
api_v1_router.include_router(
    notification_preferences.router,
    prefix="/notification-preferences",
    tags=["Notification Preferences"],
)
api_v1_router.include_router(readings.router, prefix="/readings", tags=["Readings"])
api_v1_router.include_router(weather.router, prefix="/weather", tags=["Weather"])
api_v1_router.include_router(
    ndvi_snapshots.router, prefix="/ndvi-snapshots", tags=["NDVI Snapshots"]
)
api_v1_router.include_router(
    thresholds.router,
    prefix="/thresholds",
    tags=["Thresholds"],
)
api_v1_router.include_router(alerts.router, prefix="/alerts", tags=["Alerts"])
api_v1_router.include_router(
    audit_logs.router,
    prefix="/audit-logs",
    tags=["Audit Logs"],
)
api_v1_router.include_router(
    ai_reports.router,
    prefix="/ai-reports",
    tags=["AI Reports"],
)
api_v1_router.include_router(
    ai_assistant.router,
    prefix="/ai-assistant",
    tags=["AI Assistant"],
)
