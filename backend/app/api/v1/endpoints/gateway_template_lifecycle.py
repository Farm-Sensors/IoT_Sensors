from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.db.session import get_db
from app.models.user import User
from app.services import gateway_template_lifecycle as service

router = APIRouter()


@router.post("/{template_id}/versions/{version_id}/activate")
def activate_version(
    template_id: int,
    version_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return service.activate_version(db, template_id, version_id)


@router.post("/{template_id}/versions/{version_id}/retire")
def retire_version(
    template_id: int,
    version_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return service.retire_version(db, template_id, version_id)


@router.post("/{template_id}/retire")
def retire_template(
    template_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return service.retire_template(db, template_id)
