from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import GatewayTemplate, GatewayTemplateVersion, HardwareProfile
from app.schemas.gateway_template import (
    GatewayTemplateCreate,
    GatewayTemplateDefinition,
    GatewayTemplateVersionCreate,
)


def _template_or_404(db: Session, template_id: int, *, lock: bool = False) -> GatewayTemplate:
    query = select(GatewayTemplate).where(GatewayTemplate.id == template_id)
    if lock:
        query = query.with_for_update()
    template = db.execute(query).scalar_one_or_none()
    if template is None:
        raise HTTPException(status_code=404, detail="Gateway template not found")
    return template


def _validate_profiles(db: Session, definition: GatewayTemplateDefinition) -> None:
    codes = {
        slot.hardware_profile_code
        for slot in definition.slots
        if slot.hardware_profile_code is not None
    }
    if not codes:
        return
    approved = set(
        db.scalars(
            select(HardwareProfile.codigo).where(
                HardwareProfile.codigo.in_(codes), HardwareProfile.activo.is_(True)
            )
        )
    )
    if approved != codes:
        raise HTTPException(status_code=422, detail="Unknown or inactive hardware profile")


def _definition_payload(definition: GatewayTemplateDefinition) -> dict:
    return definition.model_dump(mode="json")


def _versions(db: Session, template_id: int) -> list[GatewayTemplateVersion]:
    return list(
        db.scalars(
            select(GatewayTemplateVersion)
            .where(GatewayTemplateVersion.plantilla_id == template_id)
            .order_by(GatewayTemplateVersion.version)
        )
    )


def list_templates(db: Session, page: int, per_page: int) -> tuple[list[GatewayTemplate], int]:
    total = db.scalar(select(func.count()).select_from(GatewayTemplate)) or 0
    rows = list(
        db.scalars(
            select(GatewayTemplate)
            .order_by(GatewayTemplate.id)
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
    )
    return rows, total


def get_template(
    db: Session, template_id: int
) -> tuple[GatewayTemplate, list[GatewayTemplateVersion]]:
    template = _template_or_404(db, template_id)
    return template, _versions(db, template_id)


def create_template(
    db: Session, data: GatewayTemplateCreate
) -> tuple[GatewayTemplate, list[GatewayTemplateVersion]]:
    _validate_profiles(db, data.definition)
    template = GatewayTemplate(nombre=data.name, estado="draft")
    db.add(template)
    db.flush()
    first_version = GatewayTemplateVersion(
        plantilla_id=template.id,
        version=1,
        estado="draft",
        definicion=_definition_payload(data.definition),
    )
    db.add(first_version)
    db.commit()
    return get_template(db, template.id)


def create_version(
    db: Session, template_id: int, data: GatewayTemplateVersionCreate
) -> GatewayTemplateVersion:
    _validate_profiles(db, data.definition)
    template = _template_or_404(db, template_id, lock=True)
    if template.estado == "retired":
        raise HTTPException(status_code=409, detail="Retired templates cannot be versioned")
    current = (
        db.scalar(
            select(func.max(GatewayTemplateVersion.version)).where(
                GatewayTemplateVersion.plantilla_id == template.id
            )
        )
        or 0
    )
    version = GatewayTemplateVersion(
        plantilla_id=template.id,
        version=current + 1,
        estado="draft",
        definicion=_definition_payload(data.definition),
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return version
