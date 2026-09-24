"""Persistence contract for #29; lifecycle services belong to later issues."""

from datetime import datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models import (
    ActivationReference,
    Gateway,
    GatewayConfig,
    GatewaySlot,
    GatewayTemplate,
    GatewayTemplateVersion,
    PhysicalBinding,
    Reading,
)


@pytest.fixture
def gateway(db, sample_property):
    row = Gateway(predio_id=sample_property.id)
    db.add(row)
    db.flush()
    return row


@pytest.fixture
def slot(db, gateway, sample_node):
    row = GatewaySlot(
        pasarela_id=gateway.id, nodo_id=sample_node.id, area_riego_id=sample_node.area_riego_id
    )
    db.add(row)
    db.flush()
    return row


def reject(db, row):
    with pytest.raises(IntegrityError), db.begin_nested():
        db.add(row)
        db.flush()


def binding(slot, **overrides):
    values = dict(
        pasarela_id=slot.pasarela_id,
        ranura_id=slot.id,
        nodo_id=slot.nodo_id,
        area_riego_id=slot.area_riego_id,
        uid="synthetic-uid",
        numero_serie="synthetic-serial",
    )
    return PhysicalBinding(**(values | overrides))


def test_one_gateway_per_property(db, gateway):
    reject(db, Gateway(predio_id=gateway.predio_id))
    assert gateway.estado == "pending_activation"
    assert gateway.credencial_hash is None and gateway.ultimo_heartbeat_en is None
    assert gateway.property.id == gateway.predio_id


def test_configuration_versions_are_unique_per_property(db, gateway):
    values = dict(
        predio_id=gateway.predio_id, pasarela_id=gateway.id, version=1, snapshot={"slots": []}
    )
    db.add(GatewayConfig(**values))
    db.flush()
    reject(db, GatewayConfig(**values))
    db.add(GatewayConfig(**(values | {"version": 2})))
    db.flush()


def test_activation_stores_only_digest_and_lifecycle_metadata(db, gateway, admin_user):
    created = datetime(2026, 9, 23)
    row = ActivationReference(
        pasarela_id=gateway.id,
        referencia_hash="a" * 64,
        emitido_por_usuario_id=admin_user.id,
        creado_en=created,
        expira_en=created + timedelta(hours=24),
    )
    db.add(row)
    db.flush()
    db.refresh(row)
    assert row.expira_en - row.creado_en == timedelta(hours=24)
    assert row.usado_en is None and row.resultado == "issued"
    assert "activation_reference" not in row.__table__.columns
    assert "credential" not in gateway.__table__.columns
    for value in ("ar_synthetic-not-a-hash", "gk_synthetic-not-a-hash", "z" * 64):
        with pytest.raises(ValueError):
            row.referencia_hash = value
        with pytest.raises(ValueError):
            gateway.credencial_hash = value


def test_preparing_slot_does_not_create_binding(db, slot, sample_node):
    assert db.scalar(select(PhysicalBinding.id)) is None
    assert sample_node.gateway_slot.id == slot.id
    reject(
        db,
        GatewaySlot(
            pasarela_id=slot.pasarela_id, nodo_id=slot.nodo_id, area_riego_id=slot.area_riego_id
        ),
    )


def test_confirmed_binding_uniqueness_and_retained_history(db, slot):
    original = binding(
        slot,
        estado="confirmed",
        confirmado_en=datetime(2026, 9, 23),
        confirmado_por_pasarela_id=slot.pasarela_id,
    )
    db.add(original)
    db.flush()
    reject(
        db,
        binding(
            slot,
            uid="replacement",
            estado="confirmed",
            confirmado_en=datetime(2026, 9, 24),
            confirmado_por_pasarela_id=slot.pasarela_id,
        ),
    )
    replacement = binding(slot, uid="replacement")
    db.add(replacement)
    db.flush()
    assert original.nodo_confirmado_id == slot.nodo_id
    assert replacement.nodo_confirmado_id is None
    original.estado, original.cerrado_en = "closed", datetime(2026, 9, 24)
    db.flush()
    replacement.estado, replacement.confirmado_en = "confirmed", datetime(2026, 9, 24)
    replacement.confirmado_por_pasarela_id = slot.pasarela_id
    db.flush()
    db.refresh(original)
    assert original.nodo_confirmado_id is None
    assert len(db.scalars(select(PhysicalBinding)).all()) == 2


def test_binding_cannot_change_selected_slot_identity(db, slot):
    reject(db, binding(slot, area_riego_id=slot.area_riego_id + 999))
    reject(
        db,
        binding(
            slot,
            estado="confirmed",
            confirmado_en=datetime(2026, 9, 23),
            confirmado_por_pasarela_id=slot.pasarela_id + 999,
        ),
    )


def test_template_versions_do_not_mutate_published_configuration(db, gateway):
    template = GatewayTemplate(nombre="Synthetic template")
    db.add(template)
    db.flush()
    version = GatewayTemplateVersion(plantilla_id=template.id, version=1, definicion={"slots": []})
    db.add(version)
    db.flush()
    config = GatewayConfig(
        predio_id=gateway.predio_id,
        pasarela_id=gateway.id,
        version=1,
        snapshot={"slots": []},
        version_plantilla_id=version.id,
    )
    db.add(config)
    db.flush()
    version.definicion = {"slots": [{"profile": "other"}]}
    db.flush()
    db.refresh(config)
    assert config.snapshot == {"slots": []}
    reject(db, GatewayTemplateVersion(plantilla_id=template.id, version=1, definicion={}))


def test_reading_additions_preserve_legacy_data(db, gateway, sample_node):
    legacy = Reading(nodo_id=sample_node.id, marca_tiempo=datetime(2026, 9, 23), event_id="legacy")
    db.add(legacy)
    db.flush()
    assert legacy.pasarela_id is None and legacy.marca_tiempo_sospechosa is False
    values = dict(
        nodo_id=sample_node.id,
        pasarela_id=gateway.id,
        marca_tiempo=datetime(2026, 9, 24),
        event_id="gateway-event",
    )
    db.add(Reading(**values))
    db.flush()
    reject(db, Reading(**values))
    assert sample_node.api_key == "ak_test_key_000"
    sample_node.api_key = None
    db.flush()
    assert not any("ndvi" in c.name for c in Reading.__table__.columns)
