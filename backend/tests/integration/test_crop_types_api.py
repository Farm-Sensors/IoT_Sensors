"""Tests de integración para /api/v1/crop-types."""



class TestListCropTypes:
    def test_list_requires_auth(self, client):
        resp = client.get("/api/v1/crop-types")
        assert resp.status_code == 401

    def test_list_success(self, client, admin_headers, sample_crop_type):
        resp = client.get("/api/v1/crop-types", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1

    def test_list_accessible_by_cliente(self, client, client_headers, sample_crop_type):
        """Los tipos de cultivo son visibles para cualquier usuario autenticado."""
        resp = client.get("/api/v1/crop-types", headers=client_headers)
        assert resp.status_code == 200


class TestCreateCropType:
    def test_create_success(self, client, admin_headers):
        resp = client.post(
            "/api/v1/crop-types",
            json={"name": "Trigo", "description": "Cereal de invierno"},
            headers=admin_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Trigo"

    def test_create_requires_admin(self, client, client_headers):
        resp = client.post(
            "/api/v1/crop-types",
            json={"name": "No Permitido"},
            headers=client_headers,
        )
        assert resp.status_code == 403

    def test_create_duplicate_name_returns_409(self, client, admin_headers, sample_crop_type):
        resp = client.post(
            "/api/v1/crop-types",
            json={"name": "Nogal"},
            headers=admin_headers,
        )
        assert resp.status_code == 409

    def test_create_missing_name_returns_422(self, client, admin_headers):
        resp = client.post("/api/v1/crop-types", json={}, headers=admin_headers)
        assert resp.status_code == 422


class TestGetCropType:
    def test_get_success(self, client, admin_headers, sample_crop_type):
        resp = client.get(f"/api/v1/crop-types/{sample_crop_type.id}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "Nogal"

    def test_get_nonexistent_returns_404(self, client, admin_headers):
        resp = client.get("/api/v1/crop-types/99999", headers=admin_headers)
        assert resp.status_code == 404


class TestUpdateCropType:
    def test_update_description(self, client, admin_headers, sample_crop_type):
        resp = client.put(
            f"/api/v1/crop-types/{sample_crop_type.id}",
            json={"description": "Actualizado"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["description"] == "Actualizado"


class TestDeleteCropType:
    def test_delete_unused_crop_type(self, client, admin_headers):
        created = client.post(
            "/api/v1/crop-types",
            json={"name": "Cacao"},
            headers=admin_headers,
        ).json()
        resp = client.delete(f"/api/v1/crop-types/{created['id']}", headers=admin_headers)
        assert resp.status_code == 200

    def test_delete_in_use_crop_type_returns_409(self, client, admin_headers, sample_crop_type, sample_irrigation_area):
        """No se puede borrar un tipo de cultivo asignado a un área activa."""
        resp = client.delete(
            f"/api/v1/crop-types/{sample_crop_type.id}", headers=admin_headers
        )
        assert resp.status_code == 409


PHOTO = "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Ejemplo.jpg/320px-Ejemplo.jpg"
PAGE = "https://commons.wikimedia.org/wiki/File:Ejemplo.jpg"


class TestCropTypePhoto:
    def test_create_with_photo_returns_it(self, client, admin_headers):
        resp = client.post(
            "/api/v1/crop-types",
            json={"name": "Sorgo", "photo_url": PHOTO, "photo_credit": "Autor · CC BY-SA 4.0", "photo_page": PAGE},
            headers=admin_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["photo_url"] == PHOTO
        assert data["photo_credit"] == "Autor · CC BY-SA 4.0"
        assert data["photo_page"] == PAGE

    def test_photo_is_optional_and_defaults_to_none(self, client, admin_headers):
        resp = client.post("/api/v1/crop-types", json={"name": "Avena"}, headers=admin_headers)
        assert resp.status_code == 201
        assert resp.json()["photo_url"] is None

    def test_photo_must_come_from_wikimedia(self, client, admin_headers):
        resp = client.post(
            "/api/v1/crop-types",
            json={"name": "Cebada", "photo_url": "https://ejemplo.com/foto.jpg"},
            headers=admin_headers,
        )
        assert resp.status_code == 422

    def test_update_sets_and_then_removes_photo_with_its_credit(self, client, admin_headers):
        created = client.post("/api/v1/crop-types", json={"name": "Frijol"}, headers=admin_headers).json()
        url = f"/api/v1/crop-types/{created['id']}"
        resp = client.put(url, json={"photo_url": PHOTO, "photo_credit": "Autor", "photo_page": PAGE}, headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["photo_url"] == PHOTO and resp.json()["photo_credit"] == "Autor"
        resp = client.put(url, json={"photo_url": None}, headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["photo_url"] is None
        assert resp.json()["photo_credit"] is None and resp.json()["photo_page"] is None

    def test_renaming_does_not_touch_the_photo(self, client, admin_headers):
        created = client.post("/api/v1/crop-types", json={"name": "Lenteja", "photo_url": PHOTO}, headers=admin_headers).json()
        resp = client.put(f"/api/v1/crop-types/{created['id']}", json={"name": "Lenteja roja"}, headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["photo_url"] == PHOTO
