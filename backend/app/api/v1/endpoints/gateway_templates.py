from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.base import PaginatedResponse
from app.schemas.gateway_template import (
    GatewayTemplateCreate,
    GatewayTemplateDetailResponse,
    GatewayTemplateSummaryResponse,
    GatewayTemplateVersionCreate,
    GatewayTemplateVersionResponse,
)
from app.services import gateway_template as template_service

router = APIRouter()


@router.get("", response_model=PaginatedResponse[GatewayTemplateSummaryResponse])
def list_templates(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    templates, total = template_service.list_templates(db, page, per_page)
    return PaginatedResponse(
        page=page,
        per_page=per_page,
        total=total,
        data=[GatewayTemplateSummaryResponse.model_validate(item) for item in templates],
    )


@router.post("", response_model=GatewayTemplateDetailResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    data: GatewayTemplateCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    template, versions = template_service.create_template(db, data)
    return GatewayTemplateDetailResponse(
        **GatewayTemplateSummaryResponse.model_validate(template).model_dump(),
        versions=versions,
    )


@router.get("/{template_id}", response_model=GatewayTemplateDetailResponse)
def get_template(
    template_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    template, versions = template_service.get_template(db, template_id)
    return GatewayTemplateDetailResponse(
        **GatewayTemplateSummaryResponse.model_validate(template).model_dump(),
        versions=versions,
    )


@router.post(
    "/{template_id}/versions",
    response_model=GatewayTemplateVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_version(
    template_id: int,
    data: GatewayTemplateVersionCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return template_service.create_version(db, template_id, data)
