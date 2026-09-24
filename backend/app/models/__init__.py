from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.password_reset_token import PasswordResetToken
from app.models.client import Client
from app.models.property import Property
from app.models.crop_type import CropType
from app.models.irrigation_area import IrrigationArea
from app.models.crop_cycle import CropCycle
from app.models.node import Node
from app.models.reading import Reading
from app.models.threshold import Threshold
from app.models.alert import Alert
from app.models.audit_log import AuditLog
from app.models.notification_preference import NotificationPreference
from app.models.ai_report import AIReport
from app.models.ndvi_snapshot import NDVILatestSnapshot

from app.models.gateway import Gateway
from app.models.activation_reference import ActivationReference
from app.models.hardware_profile import HardwareProfile
from app.models.gateway_template import GatewayTemplate, GatewayTemplateVersion
from app.models.gateway_slot import GatewaySlot
from app.models.gateway_config import GatewayConfig
from app.models.physical_binding import PhysicalBinding
from app.models.gateway_update import GatewayUpdateAuthorization, GatewayUpdateConfirmation


__all__ = [
    "User",
    "RefreshToken",
    "PasswordResetToken",
    "Client",
    "Property",
    "CropType",
    "IrrigationArea",
    "CropCycle",
    "Node",
    "Reading",
    "Threshold",
    "Alert",
    "AuditLog",
    "NotificationPreference",
    "AIReport",
    "NDVILatestSnapshot",
    "Gateway",
    "ActivationReference",
    "HardwareProfile",
    "GatewayTemplate",
    "GatewayTemplateVersion",
    "GatewaySlot",
    "GatewayConfig",
    "PhysicalBinding",
    "GatewayUpdateAuthorization",
    "GatewayUpdateConfirmation",
]
