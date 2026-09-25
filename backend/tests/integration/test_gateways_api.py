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
