from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import HardwareProfile
from app.schemas.hardware_profile import HardwareProfileCreate, HardwareProfileUpdate


def list_profiles(db: Session, page: int, per_page: int) -> tuple[list[HardwareProfile], int]:
    total = db.scalar(select(func.count()).select_from(HardwareProfile)) or 0
    profiles = list(
        db.scalars(
            select(HardwareProfile)
            .order_by(HardwareProfile.codigo)
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
    )
    return profiles, total


def create_profile(db: Session, data: HardwareProfileCreate) -> HardwareProfile:
    profile = HardwareProfile(codigo=data.code.strip(), nombre=data.name.strip())
    db.add(profile)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Hardware profile code already exists",
        ) from exc
    db.refresh(profile)
    return profile


def update_profile(db: Session, profile_id: int, data: HardwareProfileUpdate) -> HardwareProfile:
    profile = db.get(HardwareProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Hardware profile not found")
    updates = data.model_dump(exclude_unset=True)
    if updates.get("code") is not None:
        profile.codigo = updates["code"].strip()
    if updates.get("name") is not None:
        profile.nombre = updates["name"].strip()
    if updates.get("active") is not None:
        profile.activo = updates["active"]
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Hardware profile code already exists",
        ) from exc
    db.refresh(profile)
    return profile
