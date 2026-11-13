"""Tests de integración para /api/v1/properties."""
import pytest




class TestListProperties:
    def test_list_requires_auth(self, client):
        resp = client.get("/api/v1/properties")
        assert resp.status_code == 401

    def test_list_success_admin(self, client, admin_headers, sample_property):
        resp = client.get("/api/v1/properties", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert data["total"] >= 1

    def test_list_filter_by_client(self, client, admin_headers, sample_property, client_user):
        _, client_record = client_user
        resp = client.get(
            f"/api/v1/properties?client_id={client_record.id}", headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert all(p["client_id"] == client_record.id for p in data["data"])


class TestCreateProperty:
    def test_create_success(self, client, admin_headers, client_user):
        _, client_record = client_user
        resp = client.post(
            "/api/v1/properties",
            json={"client_id": client_record.id, "name": "Rancho API", "location": "Sonora"},
            headers=admin_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Rancho API"
        assert data["client_id"] == client_record.id

    def test_create_invalid_client_returns_404(self, client, admin_headers):
        resp = client.post(
            "/api/v1/properties",
            json={"client_id": 99999, "name": "Rancho Invalido"},
            headers=admin_headers,
        )
        assert resp.status_code == 404

    def test_create_requires_admin(self, client, client_headers, client_user):
        _, client_record = client_user
        resp = client.post(
            "/api/v1/properties",
            json={"client_id": client_record.id, "name": "No Permission"},
            headers=client_headers,
        )
        assert resp.status_code == 403


class TestGetProperty:
    def test_get_success(self, client, admin_headers, sample_property):
        resp = client.get(f"/api/v1/properties/{sample_property.id}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == sample_property.id

    def test_get_nonexistent_returns_404(self, client, admin_headers):
        resp = client.get("/api/v1/properties/99999", headers=admin_headers)
        assert resp.status_code == 404


class TestUpdateProperty:
    def test_update_name(self, client, admin_headers, sample_property):
        resp = client.put(
            f"/api/v1/properties/{sample_property.id}",
            json={"name": "Rancho Modificado"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Rancho Modificado"

    def test_admin_sets_and_clears_reference_location(self, client, admin_headers, sample_property):
        url = f"/api/v1/properties/{sample_property.id}"
        resp = client.put(url, json={"latitude": 28.19, "longitude": -105.47}, headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["latitude"] == 28.19 and resp.json()["longitude"] == -105.47
        # Updating only the name keeps the location.
        assert client.put(url, json={"name": "Otro"}, headers=admin_headers).json()["latitude"] == 28.19
        cleared = client.put(url, json={"latitude": None, "longitude": None}, headers=admin_headers)
        assert cleared.status_code == 200
        assert cleared.json()["latitude"] is None and cleared.json()["longitude"] is None

    @pytest.mark.parametrize(
        "body",
        [{"latitude": 28.19}, {"latitude": 91, "longitude": 0}, {"latitude": 0, "longitude": -181}, {"latitude": 28.1, "longitude": None}],
    )
    def test_reference_location_is_validated(self, client, admin_headers, sample_property, body):
        resp = client.put(f"/api/v1/properties/{sample_property.id}", json=body, headers=admin_headers)
        assert resp.status_code == 422

    def test_client_cannot_edit_reference_location(self, client, client_headers, sample_property):
        resp = client.put(
            f"/api/v1/properties/{sample_property.id}",
            json={"latitude": 1, "longitude": 1},
            headers=client_headers,
        )
        assert resp.status_code == 403


class TestDeleteProperty:
    def test_delete_property(self, client, admin_headers, client_user):
        _, client_record = client_user
        created = client.post(
            "/api/v1/properties",
            json={"client_id": client_record.id, "name": "Para Borrar"},
            headers=admin_headers,
        ).json()
        resp = client.delete(f"/api/v1/properties/{created['id']}", headers=admin_headers)
        assert resp.status_code == 200
        resp2 = client.get(f"/api/v1/properties/{created['id']}", headers=admin_headers)
        assert resp2.status_code == 404
