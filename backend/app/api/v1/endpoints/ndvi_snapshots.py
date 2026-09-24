from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.authz import validate_area_access
from app.core.deps import get_current_user, validate_gateway_credential
from app.db.session import get_db
from app.models.gateway import Gateway
from app.models.user import User
from app.schemas.ndvi import NDVIEvent, NDVISnapshotResponse
from app.services import irrigation_area as area_service
from app.services import gateway_config as gateway_config_service
from app.services import ndvi as ndvi_service

router = APIRouter()


@router.post(
    "",
    response_model=NDVISnapshotResponse,
    status_code=status.HTTP_201_CREATED,
    responses={status.HTTP_200_OK: {"model": NDVISnapshotResponse}},
)
def ingest_latest_ndvi(
    data: NDVIEvent,
    response: Response,
    gateway: Gateway = Depends(validate_gateway_credential),
    db: Session = Depends(get_db),
):
    _, configuration = gateway_config_service.poll_configuration(
        db, gateway, config_version=None, bindings_revision=None
    )

    configured_area_ids = {
        slot.get("irrigation_area_id")
        for slot in configuration["configuration"].get("slots", [])
    }
    if data.irrigation_area_id not in configured_area_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Irrigation area is outside the gateway's active configuration",
        )

    area = area_service.get_irrigation_area(db, data.irrigation_area_id)
    try:
        result = ndvi_service.store_latest_ndvi_with_result(db, area, data)
    except ndvi_service.NDVIAreaMismatchError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Irrigation area with id {data.irrigation_area_id} not found",
        ) from exc
    except ndvi_service.NDVIStaleError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except ndvi_service.NDVIConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    db.commit()
    db.refresh(result.snapshot)
    response.status_code = (
        status.HTTP_201_CREATED if result.action == "created" else status.HTTP_200_OK
    )
    response.headers["X-NDVI-Write-Result"] = result.action
    return NDVISnapshotResponse.model_validate(result.snapshot)


@router.get("/latest", response_model=NDVISnapshotResponse)
def get_latest_ndvi(
    irrigation_area_id: int = Query(..., ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    validate_area_access(current_user, db, irrigation_area_id)
    area_service.get_irrigation_area(db, irrigation_area_id)
    snapshot = ndvi_service.get_latest_ndvi(db, irrigation_area_id)
    if snapshot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Latest NDVI snapshot not found",
        )
    return NDVISnapshotResponse.model_validate(snapshot)
