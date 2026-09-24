from app.models import HardwareProfile


def test_admin_manages_non_secret_hardware_profiles(client, admin_headers, db):
    created = client.post(
        "/api/v1/hardware-profiles",
        headers=admin_headers,
        json={"code": " Soil-Irrigation-V1 ", "name": " Soil and irrigation "},
    )
    assert created.status_code == 201
    profile = created.json()
    assert profile == {
        "id": profile["id"],
        "code": "soil-irrigation-v1",
        "name": "Soil and irrigation",
        "active": True,
    }
    assert "credential" not in created.text and "api_key" not in created.text

    listed = client.get("/api/v1/hardware-profiles", headers=admin_headers)
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["data"][0]["id"] == profile["id"]

    disabled = client.patch(
        f"/api/v1/hardware-profiles/{profile['id']}",
        headers=admin_headers,
        json={"active": False},
    )
    assert disabled.status_code == 200
    assert disabled.json()["active"] is False
    assert db.get(HardwareProfile, profile["id"]).activo is False


def test_hardware_profile_duplicate_code_conflicts_and_requires_admin(client, admin_headers):
    body = {"code": "generic-profile-v1", "name": "Generic profile"}
    assert (
        client.post("/api/v1/hardware-profiles", headers=admin_headers, json=body).status_code
        == 201
    )
    duplicate = client.post("/api/v1/hardware-profiles", headers=admin_headers, json=body)
    assert duplicate.status_code == 409
    assert client.get("/api/v1/hardware-profiles").status_code == 401
