from app.models import HardwareProfile


def _definition(area_name):
    return {"slots": [{"area_name": area_name, "hardware_profile_code": "soil-v1"}]}


def test_admin_creates_and_versions_global_gateway_template(client, db, admin_headers):
    db.add(HardwareProfile(codigo="soil-v1", nombre="Soil sensor profile", activo=True))
    db.commit()
    created = client.post(
        "/api/v1/gateway-templates",
        headers=admin_headers,
        json={"name": "Standard ranch", "definition": _definition("North Field")},
    )
    assert created.status_code == 201
    template = created.json()
    assert template["status"] == "draft"
    assert template["versions"][0]["version"] == 1
    assert template["versions"][0]["definition"] == _definition("North Field")

    version2 = client.post(
        f"/api/v1/gateway-templates/{template['id']}/versions",
        headers=admin_headers,
        json={"definition": _definition("South Field")},
    )
    assert version2.status_code == 201
    assert version2.json()["version"] == 2

    listing = client.get("/api/v1/gateway-templates?page=1&per_page=10", headers=admin_headers)
    assert listing.json()["total"] == 1
    assert listing.json()["data"][0]["status"] == "draft"
    assert len(db.query(HardwareProfile).all()) == 1


def test_template_rejects_unknown_profiles_duplicate_selectors_and_non_admin(client, admin_headers):
    invalid_profile = client.post(
        "/api/v1/gateway-templates",
        headers=admin_headers,
        json={"name": "Bad profile", "definition": _definition("North Field")},
    )
    assert invalid_profile.status_code == 422

    duplicate_selectors = client.post(
        "/api/v1/gateway-templates",
        headers=admin_headers,
        json={
            "name": "Duplicate areas",
            "definition": {
                "slots": [
                    {"area_name": "North Field"},
                    {"area_name": " north field "},
                ]
            },
        },
    )
    assert duplicate_selectors.status_code == 422
    assert client.get("/api/v1/gateway-templates").status_code == 401
