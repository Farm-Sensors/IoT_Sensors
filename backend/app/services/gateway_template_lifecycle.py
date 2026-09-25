"""Version activation and retirement for global gateway templates."""

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import GatewayTemplate, GatewayTemplateVersion


def _template_or_404(db: Session, template_id: int, *, lock: bool = False) -> GatewayTemplate:
    query = select(GatewayTemplate).where(GatewayTemplate.id == template_id)
    if lock:
        query = query.with_for_update()
    template = db.execute(query).scalar_one_or_none()
    if template is None:
        raise HTTPException(status_code=404, detail="Gateway template not found")
    return template


def _version_or_404(db: Session, template_id: int, version_id: int) -> GatewayTemplateVersion:
    version = db.execute(
        select(GatewayTemplateVersion).where(
            GatewayTemplateVersion.id == version_id,
            GatewayTemplateVersion.plantilla_id == template_id,
        )
    ).scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Gateway template version not found")
    return version


def _result(template: GatewayTemplate, version: GatewayTemplateVersion | None = None) -> dict:
    result = {"template_id": template.id, "template_status": template.estado}
    if version is not None:
        result.update(
            version_id=version.id,
            version=version.version,
            version_status=version.estado,
        )
    return result


def activate_version(db: Session, template_id: int, version_id: int) -> dict:
    template = _template_or_404(db, template_id, lock=True)
    version = _version_or_404(db, template_id, version_id)
    if template.estado == "retired" or version.estado == "retired":
        raise HTTPException(status_code=409, detail="Retired templates or versions cannot be activated")
    if version.estado == "draft":
        version.estado = "active"
        template.estado = "active"
        db.commit()
        db.refresh(template)
        db.refresh(version)
    return _result(template, version)


def retire_version(db: Session, template_id: int, version_id: int) -> dict:
    template = _template_or_404(db, template_id, lock=True)
    version = _version_or_404(db, template_id, version_id)
    if version.estado != "retired":
        version.estado = "retired"
        active_versions = db.scalar(
            select(func.count())
            .select_from(GatewayTemplateVersion)
            .where(
                GatewayTemplateVersion.plantilla_id == template_id,
                GatewayTemplateVersion.estado == "active",
                GatewayTemplateVersion.id != version_id,
            )
        )
        if not active_versions and template.estado == "active":
            template.estado = "draft"
        db.commit()
        db.refresh(template)
        db.refresh(version)
    return _result(template, version)


def retire_template(db: Session, template_id: int) -> dict:
    template = _template_or_404(db, template_id, lock=True)
    if template.estado != "retired":
        template.estado = "retired"
        db.execute(
            update(GatewayTemplateVersion)
            .where(GatewayTemplateVersion.plantilla_id == template_id)
            .values(estado="retired")
        )
        db.commit()
        db.refresh(template)
    return _result(template)
