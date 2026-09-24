from datetime import timedelta
import hashlib

from sqlalchemy import select

from app.models import ActivationReference, Gateway


def _activate(client, reference):
    return client.post("/api/v1/gateways/activate", json={"activation_reference": reference})


def _gateway(db, sample_property, *, active=False):
    gateway = Gateway(
        predio_id=sample_property.id,
        estado="active" if active else "pending_activation",
        credencial_hash=hashlib.sha256(b"old credential").hexdigest() if active else None,
        credencial_prefijo="gk_old-pref" if active else None,
    )
    db.add(gateway)
    db.commit()
    db.refresh(gateway)
    return gateway


def test_activation_reference_is_hashed_single_use_and_secret_redacted(
    client, db, admin_headers, admin_user, sample_property
):
    gateway = _gateway(db, sample_property)
    issued = client.post(
        f"/api/v1/gateways/{gateway.id}/activation-references", headers=admin_headers
    )
    assert issued.status_code == 201
    reference = issued.json()["activation_reference"]
    row = db.scalar(select(ActivationReference))
    assert row.referencia_hash == hashlib.sha256(reference.encode()).hexdigest()
    assert row.expira_en - row.creado_en == timedelta(hours=24)
    assert row.emitido_por_usuario_id == admin_user.id
    assert issued.json()["expires_at"].endswith("Z")

    activated = _activate(client, reference)
    assert activated.status_code == 200
    credential = activated.json()["credential"]
    assert credential.startswith("gk_")
    assert gateway.credencial_hash == hashlib.sha256(credential.encode()).hexdigest()
    assert row.resultado == "consumed"
    retry = _activate(client, reference)
    assert retry.status_code == 401
    assert retry.json() == {"code": "invalid_activation_reference", "message": "Activation failed"}


def test_expired_unknown_and_malformed_references_have_same_failure(
    client, db, admin_headers, sample_property, monkeypatch
):
    gateway = _gateway(db, sample_property)
    reference = client.post(
        f"/api/v1/gateways/{gateway.id}/activation-references", headers=admin_headers
    ).json()["activation_reference"]
    issued_at = db.scalar(select(ActivationReference)).creado_en
    from app.services import gateway_lifecycle

    monkeypatch.setattr(gateway_lifecycle, "_now", lambda: issued_at + timedelta(hours=25))
    responses = [_activate(client, value) for value in [reference, "ar_" + "x" * 48, "bad"]]
    expected = {"code": "invalid_activation_reference", "message": "Activation failed"}
    assert all(response.status_code == 401 and response.json() == expected for response in responses)
    assert gateway.estado == "pending_activation"


def test_reissuing_reference_invalidates_previous_reference(client, db, admin_headers, sample_property):
    gateway = _gateway(db, sample_property)
    path = f"/api/v1/gateways/{gateway.id}/activation-references"
    first = client.post(path, headers=admin_headers).json()["activation_reference"]
    second = client.post(path, headers=admin_headers).json()["activation_reference"]
    refs = list(db.scalars(select(ActivationReference).order_by(ActivationReference.id)))
    assert refs[0].resultado == "revoked"
    assert refs[1].resultado == "issued"
    old = _activate(client, first)
    assert old.status_code == 401
    new = _activate(client, second)
    assert new.status_code == 200


def test_credential_rotation_replaces_hash_and_returns_secret_only_once(
    client, db, admin_headers, sample_property
):
    gateway = _gateway(db, sample_property, active=True)
    old_hash = gateway.credencial_hash
    response = client.post(
        f"/api/v1/gateways/{gateway.id}/credentials/rotate", headers=admin_headers
    )
    assert response.status_code == 201
    credential = response.json()["credential"]
    assert gateway.credencial_hash == hashlib.sha256(credential.encode()).hexdigest()
    assert gateway.credencial_hash != old_hash
    assert "credencial_hash" not in response.text


def test_revocation_is_idempotent_and_invalidates_issued_reference(
    client, db, admin_headers, admin_user, sample_property
):
    gateway = _gateway(db, sample_property, active=True)
    reference = ActivationReference(
        pasarela_id=gateway.id,
        referencia_hash=hashlib.sha256(b"unused reference").hexdigest(),
        emitido_por_usuario_id=admin_user.id,
        expira_en=gateway.creado_en + timedelta(hours=24),
        resultado="issued",
    )
    db.add(reference)
    db.commit()

    path = f"/api/v1/gateways/{gateway.id}/revoke"
    assert client.post(path, headers=admin_headers).status_code == 204
    assert gateway.estado == "revoked"
    assert gateway.revocado_en is not None
    assert gateway.credencial_hash is None
    assert gateway.credencial_prefijo is None
    assert reference.resultado == "revoked"
    assert client.post(path, headers=admin_headers).status_code == 204


def test_lifecycle_routes_require_admin(client, client_headers, sample_property, db):
    gateway = _gateway(db, sample_property)
    assert client.post(f"/api/v1/gateways/{gateway.id}/revoke").status_code == 401
    assert client.post(
        f"/api/v1/gateways/{gateway.id}/revoke", headers=client_headers
    ).status_code == 403
