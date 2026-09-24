import hashlib
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException

from app.models import Gateway, GatewayConfig, GatewaySlot
from app.schemas.gateway_config import BindingCandidateCreate, BindingConfirmation
from app.services.binding import confirm_candidate, submit_candidate


@pytest.fixture
def configured_gateway(db, sample_property, sample_node):
    gateway = Gateway(
        predio_id=sample_property.id,
        estado="active",
        credencial_hash=hashlib.sha256(b"gk_unit_secret").hexdigest(),
        config_version_activa=1,
    )
    db.add(gateway)
    db.flush()
    slot = GatewaySlot(
        pasarela_id=gateway.id,
        nodo_id=sample_node.id,
        area_riego_id=sample_node.area_riego_id,
    )
    db.add(slot)
    db.flush()
    db.add(
        GatewayConfig(
            predio_id=gateway.predio_id,
            pasarela_id=gateway.id,
            version=1,
            snapshot={
                "gateway_id": gateway.id,
                "property_id": gateway.predio_id,
                "slots": [
                    {
                        "slot_id": slot.id,
                        "logical_node_id": slot.nodo_id,
                        "irrigation_area_id": slot.area_riego_id,
                        "hardware_profile_code": None,
                    }
                ],
            },
        )
    )
    db.commit()
    db.refresh(gateway)
    db.refresh(slot)
    return gateway, slot


def test_candidate_event_exact_retry_is_idempotent_and_conflict_is_rejected(
    db, configured_gateway
):
    gateway, slot = configured_gateway
    request = BindingCandidateCreate(
        slot_id=slot.id,
        logical_node_id=slot.nodo_id,
        irrigation_area_id=slot.area_riego_id,
        uid="unit-uid",
        serial="unit-serial",
    )
    candidate, state, code = submit_candidate(db, gateway, "proposal-1", request)
    assert code == 201 and state == "pending_initial"
    retry, retry_state, retry_code = submit_candidate(db, gateway, "proposal-1", request)
    assert retry.id == candidate.id and retry_state == state and retry_code == 200
    assert gateway.bindings_revision == 1

    conflicting_request = request.model_copy(update={"uid": "other-uid"})
    with pytest.raises(HTTPException) as error:
        submit_candidate(db, gateway, "proposal-1", conflicting_request)
    assert error.value.status_code == 409
    assert gateway.bindings_revision == 1


def test_confirmation_only_activates_pending_candidate_and_keeps_logical_identity(
    db, configured_gateway
):
    gateway, slot = configured_gateway
    candidate, _, _ = submit_candidate(
        db,
        gateway,
        "proposal-1",
        BindingCandidateCreate(
            slot_id=slot.id,
            logical_node_id=slot.nodo_id,
            irrigation_area_id=slot.area_riego_id,
            uid="unit-uid",
            serial="unit-serial",
        ),
    )
    confirmed_at = (datetime.now(UTC) + timedelta(minutes=1)).isoformat().replace("+00:00", "Z")
    confirmed, code = confirm_candidate(
        db,
        gateway,
        candidate.id,
        "confirm-1",
        BindingConfirmation(slot_id=slot.id, technician_confirmed_at=confirmed_at),
    )
    assert code == 200
    assert confirmed.estado == "confirmed"
    assert confirmed.confirmado_por_pasarela_id == gateway.id
    assert confirmed.nodo_id == slot.nodo_id
    assert gateway.bindings_revision == 2

    with pytest.raises(HTTPException) as error:
        confirm_candidate(
            db,
            gateway,
            candidate.id,
            "confirm-2",
            BindingConfirmation(slot_id=slot.id, technician_confirmed_at=confirmed_at),
        )
    assert error.value.status_code == 409


def test_gateway_cannot_submit_a_slot_missing_from_its_published_snapshot(
    db, configured_gateway
):
    gateway, slot = configured_gateway
    config = db.query(GatewayConfig).filter_by(pasarela_id=gateway.id).one()
    config.snapshot = {"gateway_id": gateway.id, "property_id": gateway.predio_id, "slots": []}
    db.commit()
    with pytest.raises(HTTPException) as error:
        submit_candidate(
            db,
            gateway,
            "proposal-1",
            BindingCandidateCreate(
                slot_id=slot.id,
                logical_node_id=slot.nodo_id,
                irrigation_area_id=slot.area_riego_id,
                uid="unit-uid",
                serial="unit-serial",
            ),
        )
    assert error.value.status_code == 403
