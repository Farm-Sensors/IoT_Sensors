from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.gateway_template_copy import GatewayTemplateCopyRequest
from app.services import gateway_template_copy as service

router = APIRouter()


@router.post("/{template_id}/versions/{version_id}/copies")
def copy_template_version(
    template_id: int,
    version_id: int,
    data: GatewayTemplateCopyRequest,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return service.copy_to_property(db, template_id, version_id, data.property_id)
