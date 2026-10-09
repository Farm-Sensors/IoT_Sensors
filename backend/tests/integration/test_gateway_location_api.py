from app.models import Gateway, Property

PATH = "/api/v1/gateways/me/location"


def _provision_and_activate(client, db, admin_headers, prop, node):
    gateway_id = client.post(
        "/api/v1/gateways",
        headers=admin_headers,
        json={
            "property_id": prop.id,
            "slots": [{"irrigation_area_id": node.area_riego_id}],
        },
    ).json()["id"]
    reference = client.post(
        f"/api/v1/gateways/{gateway_id}/activation-references", headers=admin_headers
    ).json()["activation_reference"]
    activated = client.post("/api/v1/gateways/activate", json={"activation_reference": reference})
    assert activated.status_code == 200, activated.text
    return db.get(Gateway, gateway_id), activated.json()["credential"]


def test_location_requires_credential_and_stores_property_coordinates(
    client, db, admin_headers, sample_property, sample_node
):
    gateway, credential = _provision_and_activate(
        client, db, admin_headers, sample_property, sample_node
    )
    body = {"location": {"latitude": 28.6739, "longitude": -106.0793}}

    assert client.post(PATH, json=body).status_code == 401

    accepted = client.post(PATH, headers={"X-API-Key": credential}, json=body)

    assert accepted.status_code == 204
    assert accepted.content == b""
    prop = db.get(Property, gateway.predio_id)
    db.refresh(prop)
    assert float(prop.latitud) == 28.6739
    assert float(prop.longitud) == -106.0793


def test_location_overwrites_the_previous_reference(
    client, db, admin_headers, sample_property, sample_node
):
    gateway, credential = _provision_and_activate(
        client, db, admin_headers, sample_property, sample_node
    )
    first = client.post(
        PATH,
        headers={"X-API-Key": credential},
        json={"location": {"latitude": 28.6739, "longitude": -106.0793}},
    )
    second = client.post(
        PATH,
        headers={"X-API-Key": credential},
        json={"location": {"latitude": -33.4489, "longitude": -70.6693}},
    )

    assert [first.status_code, second.status_code] == [204, 204]
    prop = db.get(Property, gateway.predio_id)
    db.refresh(prop)
    assert float(prop.latitud) == -33.4489
    assert float(prop.longitud) == -70.6693


def test_location_rejects_malformed_payloads(
    client, db, admin_headers, sample_property, sample_node
):
    gateway, credential = _provision_and_activate(
        client, db, admin_headers, sample_property, sample_node
    )
    before = (sample_property.latitud, sample_property.longitud)
    payloads = [
        {},
        {"location": {}},
        {"location": {"latitude": 28.6}},
        {"location": {"latitude": 91.0, "longitude": -106.0}},
        {"location": {"latitude": 28.6, "longitude": -181.0}},
        {"location": {"latitude": 28.6, "longitude": -106.0, "altitude": 1200}},
        {"location": {"latitude": "abc", "longitude": -106.0}},
    ]

    statuses = [
        client.post(PATH, headers={"X-API-Key": credential}, json=payload).status_code
        for payload in payloads
    ]

    assert statuses == [422] * len(payloads)
    prop = db.get(Property, gateway.predio_id)
    db.refresh(prop)
    assert (prop.latitud, prop.longitud) == before
