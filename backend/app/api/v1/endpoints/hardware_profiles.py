from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.base import PaginatedResponse
from app.schemas.hardware_profile import (
    HardwareProfileCreate,
    HardwareProfileResponse,
    HardwareProfileUpdate,
)
from app.services import hardware_profile as profile_service

router = APIRouter()


@router.get("", response_model=PaginatedResponse[HardwareProfileResponse])
def list_profiles(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    profiles, total = profile_service.list_profiles(db, page, per_page)
    return PaginatedResponse(
        page=page,
        per_page=per_page,
        total=total,
        data=[HardwareProfileResponse.model_validate(profile) for profile in profiles],
    )


@router.post("", response_model=HardwareProfileResponse, status_code=status.HTTP_201_CREATED)
def create_profile(
    data: HardwareProfileCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return profile_service.create_profile(db, data)


@router.patch("/{profile_id}", response_model=HardwareProfileResponse)
def update_profile(
    profile_id: int,
    data: HardwareProfileUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return profile_service.update_profile(db, profile_id, data)
