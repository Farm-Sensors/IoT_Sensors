from datetime import UTC, datetime

from sqlalchemy import select

from app.models import Gateway, GatewaySlot


def _provision(client, admin_headers, sample_property, sample_node):
    response = client.post(
        "/api/v1/gateways",
        headers=admin_headers,
        json={
            "property_id": sample_property.id,
            "slots": [{"irrigation_area_id": sample_node.area_riego_id}],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_admin_provisions_existing_property_slot_without_secrets(
    client, db, admin_headers, sample_property, sample_node
):
    result = _provision(client, admin_headers, sample_property, sample_node)

    assert result["property_id"] == sample_property.id
    assert result["status"] == "pending_activation"
    assert result["slots"][0]["logical_node_id"] == sample_node.id
    assert "credential" not in result and "activation_reference" not in result
    assert db.scalar(select(GatewaySlot).where(GatewaySlot.pasarela_id == result["id"]))


def test_provisioning_rejects_cross_property_area_and_duplicate_gateway(
    client, admin_headers, sample_property, sample_node, db, sample_crop_type
):
    other_property = type(sample_property)(
        cliente_id=sample_property.cliente_id, nombre="Other Ranch"
    )
    db.add(other_property)
    db.flush()
    from app.models import IrrigationArea, Node

    other_area = IrrigationArea(
        predio_id=other_property.id,
        tipo_cultivo_id=sample_crop_type.id,
        nombre="Other Field",
    )
    db.add(other_area)
    db.flush()
    db.add(Node(area_riego_id=other_area.id, activo=True))
    db.commit()

    response = client.post(
        "/api/v1/gateways",
        headers=admin_headers,
        json={
            "property_id": sample_property.id,
            "slots": [{"irrigation_area_id": other_area.id}],
        },
    )
    assert response.status_code == 422
    assert db.scalar(select(Gateway.id)) is None

    _provision(client, admin_headers, sample_property, sample_node)
    duplicate = client.post(
        "/api/v1/gateways",
        headers=admin_headers,
        json={
            "property_id": sample_property.id,
            "slots": [{"irrigation_area_id": sample_node.area_riego_id}],
        },
    )
    assert duplicate.status_code == 409


def test_gateway_admin_routes_require_authentication(client):
    assert client.get("/api/v1/gateways").status_code == 401
    assert client.post("/api/v1/gateways", json={}).status_code == 401


def _second_area(db, sample_property, sample_crop_type):
    from app.models import IrrigationArea, Node

    area = IrrigationArea(
        predio_id=sample_property.id,
        tipo_cultivo_id=sample_crop_type.id,
        nombre="Second Field",
    )
    db.add(area)
    db.flush()
    node = Node(area_riego_id=area.id, activo=True)
    db.add(node)
    db.commit()
    return area, node


def _provision_area(client, admin_headers, sample_property, area_id):
    return client.post(
        "/api/v1/gateways",
        headers=admin_headers,
        json={"property_id": sample_property.id, "slots": [{"irrigation_area_id": area_id}]},
    )


def _revoke(client, admin_headers, gateway_id):
    response = client.post(f"/api/v1/gateways/{gateway_id}/revoke", headers=admin_headers)
    assert response.status_code == 204, response.text


def test_reprovision_after_revoke_reuses_the_same_gateway(
    client, db, admin_headers, sample_property, sample_node
):
    first = _provision(client, admin_headers, sample_property, sample_node)
    gateway = db.get(Gateway, first["id"])
    gateway.activado_en = datetime.now(UTC).replace(tzinfo=None)
    gateway.ultimo_heartbeat_en = gateway.activado_en
    db.commit()
    _revoke(client, admin_headers, first["id"])
    assert db.get(Gateway, first["id"]).estado == "revoked"

    again = _provision(client, admin_headers, sample_property, sample_node)

    assert again["id"] == first["id"]
    assert again["status"] == "pending_activation"
    assert again["slots"][0]["logical_node_id"] == sample_node.id
    assert len(db.scalars(select(Gateway)).all()) == 1
    reused = db.get(Gateway, first["id"])
    assert reused.revocado_en is None
    assert reused.activado_en is None and reused.ultimo_heartbeat_en is None

    issued = client.post(
        f"/api/v1/gateways/{first['id']}/activation-references", headers=admin_headers
    )
    assert issued.status_code == 201, issued.text


def test_reprovision_after_revoke_swaps_unbound_slots(
    client, db, admin_headers, sample_property, sample_node, sample_crop_type
):
    first = _provision(client, admin_headers, sample_property, sample_node)
    other_area, other_node = _second_area(db, sample_property, sample_crop_type)
    _revoke(client, admin_headers, first["id"])

    again = _provision_area(client, admin_headers, sample_property, other_area.id)

    assert again.status_code == 201, again.text
    slots = db.scalars(select(GatewaySlot).where(GatewaySlot.pasarela_id == first["id"])).all()
    assert [slot.area_riego_id for slot in slots] == [other_area.id]
    assert slots[0].nodo_id == other_node.id


def test_reprovision_after_revoke_keeps_slots_with_binding_history(
    client, db, admin_headers, sample_property, sample_node, sample_crop_type
):
    from app.models import PhysicalBinding

    first = _provision(client, admin_headers, sample_property, sample_node)
    slot = db.scalar(select(GatewaySlot).where(GatewaySlot.pasarela_id == first["id"]))
    db.add(
        PhysicalBinding(
            pasarela_id=slot.pasarela_id,
            ranura_id=slot.id,
            nodo_id=slot.nodo_id,
            area_riego_id=slot.area_riego_id,
            uid="mesh-DEMO01",
            numero_serie="mesh-DEMO01",
            estado="pending",
        )
    )
    db.commit()
    other_area, _ = _second_area(db, sample_property, sample_crop_type)
    _revoke(client, admin_headers, first["id"])

    blocked = _provision_area(client, admin_headers, sample_property, other_area.id)

    assert blocked.status_code == 409
    assert "binding history" in blocked.json()["detail"]
    gateway = db.get(Gateway, first["id"])
    assert gateway.estado == "revoked"
    assert gateway.revocado_en is not None
    assert db.scalar(select(GatewaySlot).where(GatewaySlot.pasarela_id == first["id"])) is not None


def _activate(client, admin_headers, gateway_id):
    reference = client.post(
        f"/api/v1/gateways/{gateway_id}/activation-references", headers=admin_headers
    ).json()["activation_reference"]
    activated = client.post("/api/v1/gateways/activate", json={"activation_reference": reference})
    assert activated.status_code == 200, activated.text
    return {"X-API-Key": activated.json()["credential"]}


def test_provisioning_publishes_configuration_v1_pollable_right_away(
    client, db, admin_headers, sample_property, sample_node
):
    result = _provision(client, admin_headers, sample_property, sample_node)

    assert result["configuration_version"] == 1
    assert db.get(Gateway, result["id"]).config_version_activa == 1
    headers = _activate(client, admin_headers, result["id"])
    polled = client.get("/api/v1/gateways/me/configuration", headers=headers)
    assert polled.status_code == 200, polled.text
    assert polled.json()["configuration_version"] == 1
    assert [slot["logical_node_id"] for slot in polled.json()["configuration"]["slots"]] == [
        sample_node.id
    ]


def test_provisioning_creates_the_missing_nodes_and_reuses_existing_ones(
    client, db, admin_headers, sample_property, sample_node, sample_crop_type
):
    from app.models import IrrigationArea, Node

    bare = IrrigationArea(
        predio_id=sample_property.id, tipo_cultivo_id=sample_crop_type.id, nombre="Bare Field"
    )
    db.add(bare)
    db.commit()

    response = client.post(
        "/api/v1/gateways",
        headers=admin_headers,
        json={
            "property_id": sample_property.id,
            "slots": [
                {"irrigation_area_id": sample_node.area_riego_id},
                {"irrigation_area_id": bare.id},
            ],
        },
    )

    assert response.status_code == 201, response.text
    created = db.scalar(select(Node).where(Node.area_riego_id == bare.id))
    assert created is not None
    assert created.nombre == "Nodo Bare Field"
    assert created.numero_serie is None and created.activo is True
    assert db.scalars(select(Node).where(Node.area_riego_id == sample_node.area_riego_id)).all() == [
        sample_node
    ]
    slots = {slot["irrigation_area_id"]: slot["logical_node_id"] for slot in response.json()["slots"]}
    assert slots == {sample_node.area_riego_id: sample_node.id, bare.id: created.id}
    assert response.json()["configuration_version"] == 1


def test_provisioning_rejects_a_disabled_node_without_side_effects(
    client, db, admin_headers, sample_property, sample_node, sample_crop_type
):
    from app.models import IrrigationArea, Node

    bare = IrrigationArea(
        predio_id=sample_property.id, tipo_cultivo_id=sample_crop_type.id, nombre="Bare Field"
    )
    db.add(bare)
    sample_node.activo = False
    db.commit()

    response = client.post(
        "/api/v1/gateways",
        headers=admin_headers,
        json={
            "property_id": sample_property.id,
            "slots": [
                {"irrigation_area_id": bare.id},
                {"irrigation_area_id": sample_node.area_riego_id},
            ],
        },
    )

    assert response.status_code == 422
    assert "disabled node" in response.json()["detail"]
    assert db.scalar(select(Gateway.id)) is None
    assert db.scalar(select(Node).where(Node.area_riego_id == bare.id)) is None


def test_provisioning_rejects_an_area_whose_node_was_deleted(
    client, db, admin_headers, sample_property, sample_node
):
    sample_node.eliminado_en = datetime.now(UTC).replace(tzinfo=None)
    db.commit()

    response = _provision_area(client, admin_headers, sample_property, sample_node.area_riego_id)

    assert response.status_code == 409
    assert "deleted node" in response.json()["detail"]
    assert db.scalar(select(Gateway.id)) is None


def test_reprovision_after_revoke_publishes_a_new_configuration(
    client, db, admin_headers, sample_property, sample_node
):
    first = _provision(client, admin_headers, sample_property, sample_node)
    assert first["configuration_version"] == 1

    _revoke(client, admin_headers, first["id"])
    again = _provision(client, admin_headers, sample_property, sample_node)

    assert again["configuration_version"] == 2
    assert db.get(Gateway, first["id"]).config_version_activa == 2
    headers = _activate(client, admin_headers, first["id"])
    polled = client.get("/api/v1/gateways/me/configuration", headers=headers)
    assert polled.status_code == 200, polled.text
    assert polled.json()["configuration_version"] == 2


def test_explicit_republish_still_creates_the_next_version(
    client, db, admin_headers, sample_property, sample_node
):
    first = _provision(client, admin_headers, sample_property, sample_node)

    republished = client.post(
        f"/api/v1/gateways/{first['id']}/configuration", headers=admin_headers
    )

    assert republished.status_code == 201, republished.text
    assert republished.json()["configuration_version"] == 2
    assert db.get(Gateway, first["id"]).config_version_activa == 2


def _add_binding(db, slot, *, uid, state):
    from app.models import PhysicalBinding

    binding = PhysicalBinding(
        pasarela_id=slot.pasarela_id,
        ranura_id=slot.id,
        nodo_id=slot.nodo_id,
        area_riego_id=slot.area_riego_id,
        uid=uid,
        numero_serie=uid,
        estado=state,
        confirmado_en=datetime.now(UTC).replace(tzinfo=None) if state == "confirmed" else None,
        confirmado_por_pasarela_id=slot.pasarela_id if state == "confirmed" else None,
    )
    db.add(binding)
    db.commit()
    return binding


def test_reprovision_after_revoke_closes_stale_pending_candidates(
    client, db, admin_headers, sample_property, sample_node
):
    first = _provision(client, admin_headers, sample_property, sample_node)
    slot = db.scalar(select(GatewaySlot).where(GatewaySlot.pasarela_id == first["id"]))
    stale = _add_binding(db, slot, uid="mesh-OLD01", state="pending")
    _revoke(client, admin_headers, first["id"])
    revision_before = db.get(Gateway, first["id"]).bindings_revision

    again = _provision(client, admin_headers, sample_property, sample_node)

    assert again["status"] == "pending_activation"
    db.refresh(stale)
    assert stale.estado == "closed"
    assert stale.cerrado_en is not None
    assert db.get(Gateway, first["id"]).bindings_revision == revision_before + 1


def test_reprovision_after_revoke_retains_a_bound_slot_in_the_request(
    client, db, admin_headers, sample_property, sample_node
):
    first = _provision(client, admin_headers, sample_property, sample_node)
    slot = db.scalar(select(GatewaySlot).where(GatewaySlot.pasarela_id == first["id"]))
    binding = _add_binding(db, slot, uid="mesh-OLD02", state="confirmed")
    _revoke(client, admin_headers, first["id"])

    again = _provision(client, admin_headers, sample_property, sample_node)

    assert again["status"] == "pending_activation"
    db.refresh(binding)
    assert binding.estado == "confirmed"
    assert [s["id"] for s in again["slots"]] == [slot.id]
    assert db.scalar(select(GatewaySlot).where(GatewaySlot.pasarela_id == first["id"])).id == slot.id
