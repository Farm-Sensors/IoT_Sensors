"""Tests de integración para /api/v1/nodes."""

from uuid import uuid4



SENSOR_PAYLOAD = {
    "timestamp": "2026-04-01T12:00:00Z",
    "soil": {
        "conductivity": 1.0,
        "temperature": 20.0,
        "humidity": 30.0,
        "water_potential": -0.5,
    },
    "irrigation": {
        "active": False,
        "accumulated_liters": 500.0,
        "flow_per_minute": 5.0,
    },
    "environmental": {
        "temperature": 25.0,
        "relative_humidity": 60.0,
        "wind_speed": 10.0,
        "solar_radiation": 400.0,
        "eto": 3.5,
    },
}


class TestListNodes:
    def test_list_requires_auth(self, client):
        resp = client.get("/api/v1/nodes")
        assert resp.status_code == 401

    def test_list_success(self, client, admin_headers, sample_node):
        resp = client.get("/api/v1/nodes", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1

    def test_list_does_not_expose_api_key(self, client, admin_headers, sample_node):
        resp = client.get("/api/v1/nodes", headers=admin_headers)
        assert resp.status_code == 200
        for item in resp.json()["data"]:
            assert "api_key" not in item

    def test_list_filter_by_irrigation_area(
        self, client, admin_headers, sample_node, sample_irrigation_area
    ):
        resp = client.get(
            f"/api/v1/nodes?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["data"][0]["irrigation_area_id"] == sample_irrigation_area.id


class TestCreateNode:
    def test_create_success(
        self, client, admin_headers, sample_property, sample_crop_type
    ):
        # Crear área de riego separada para este test (via API)
        area_resp = client.post(
            "/api/v1/irrigation-areas",
            json={
                "property_id": sample_property.id,
                "crop_type_id": sample_crop_type.id,
                "name": "Área Para Nodo",
            },
            headers=admin_headers,
        )
        area_id = area_resp.json()["id"]
        resp = client.post(
            "/api/v1/nodes",
            json={
                "irrigation_area_id": area_id,
                "name": "Nodo API",
                "latitude": 28.5,
                "longitude": -106.0,
            },
            headers=admin_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Nodo API"
        assert "api_key" not in data

    def test_create_second_node_same_area_returns_409(
        self, client, admin_headers, sample_irrigation_area, sample_node
    ):
        resp = client.post(
            "/api/v1/nodes",
            json={"irrigation_area_id": sample_irrigation_area.id, "name": "Duplicado"},
            headers=admin_headers,
        )
        assert resp.status_code == 409

    def test_create_invalid_area_returns_404(self, client, admin_headers):
        resp = client.post(
            "/api/v1/nodes",
            json={"irrigation_area_id": 99999, "name": "Bad Node"},
            headers=admin_headers,
        )
        assert resp.status_code == 404

    def test_create_requires_admin(
        self, client, client_headers, sample_irrigation_area
    ):
        resp = client.post(
            "/api/v1/nodes",
            json={"irrigation_area_id": sample_irrigation_area.id, "name": "No Perm"},
            headers=client_headers,
        )
        assert resp.status_code == 403


class TestGetNode:
    def test_get_success(self, client, admin_headers, sample_node):
        resp = client.get(f"/api/v1/nodes/{sample_node.id}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == sample_node.id

    def test_get_does_not_expose_api_key(self, client, admin_headers, sample_node):
        resp = client.get(f"/api/v1/nodes/{sample_node.id}", headers=admin_headers)
        assert resp.status_code == 200
        assert "api_key" not in resp.json()

    def test_get_nonexistent_returns_404(self, client, admin_headers):
        resp = client.get("/api/v1/nodes/99999", headers=admin_headers)
        assert resp.status_code == 404


class TestUpdateNode:
    def test_update_name(self, client, admin_headers, sample_node):
        resp = client.put(
            f"/api/v1/nodes/{sample_node.id}",
            json={"name": "Nodo Actualizado"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Nodo Actualizado"

    def test_deactivate_node(self, client, admin_headers, sample_node):
        resp = client.put(
            f"/api/v1/nodes/{sample_node.id}",
            json={"is_active": False},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False


class TestDeleteNode:
    def test_delete_node(
        self, client, admin_headers, sample_property, sample_crop_type
    ):
        area_resp = client.post(
            "/api/v1/irrigation-areas",
            json={
                "property_id": sample_property.id,
                "crop_type_id": sample_crop_type.id,
                "name": "Área Temp",
            },
            headers=admin_headers,
        )
        area_id = area_resp.json()["id"]
        node_resp = client.post(
            "/api/v1/nodes",
            json={"irrigation_area_id": area_id, "name": "Nodo Temp"},
            headers=admin_headers,
        ).json()
        resp = client.delete(f"/api/v1/nodes/{node_resp['id']}", headers=admin_headers)
        assert resp.status_code == 200
        resp2 = client.get(f"/api/v1/nodes/{node_resp['id']}", headers=admin_headers)
        assert resp2.status_code == 404


class TestGeoNodes:
    def _create_other_client_area_and_node(
        self, client, admin_headers, sample_crop_type
    ):
        other_client_resp = client.post(
            "/api/v1/clients",
            json={
                "email": "geo-otro@test.com",
                "password": "pass123",
                "full_name": "Cliente Geo Otro",
                "company_name": "Empresa Geo Otro",
            },
            headers=admin_headers,
        )
        assert other_client_resp.status_code == 201
        other_client_id = other_client_resp.json()["id"]

        other_property_resp = client.post(
            "/api/v1/properties",
            json={"client_id": other_client_id, "name": "Predio Geo Otro"},
            headers=admin_headers,
        )
        assert other_property_resp.status_code == 201
        other_property_id = other_property_resp.json()["id"]

        other_area_resp = client.post(
            "/api/v1/irrigation-areas",
            json={
                "property_id": other_property_id,
                "crop_type_id": sample_crop_type.id,
                "name": "Area Geo Otro",
            },
            headers=admin_headers,
        )
        assert other_area_resp.status_code == 201
        other_area_id = other_area_resp.json()["id"]

        other_node_resp = client.post(
            "/api/v1/nodes",
            json={
                "irrigation_area_id": other_area_id,
                "name": "Nodo Geo Otro",
                "latitude": 29.0,
                "longitude": -107.0,
            },
            headers=admin_headers,
        )
        assert other_node_resp.status_code == 201

        return {
            "client_id": other_client_id,
            "property_id": other_property_id,
            "area_id": other_area_id,
            "node": other_node_resp.json(),
        }

    def test_geo_requires_auth(self, client):
        resp = client.get("/api/v1/nodes/geo")
        assert resp.status_code == 401

    def test_geo_does_not_expose_api_key(
        self, client, admin_headers, sample_node
    ):
        resp = client.get(
            "/api/v1/nodes/geo?include_without_coordinates=true",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1
        for item in resp.json()["data"]:
            assert "api_key" not in item

    def test_geo_admin_returns_freshness_fields(
        self,
        client,
        admin_headers,
        node_headers,
        sample_node,
        sample_irrigation_area,
    ):
        ingest = client.post(
            "/api/v1/readings", json=SENSOR_PAYLOAD, headers={"X-Event-ID": str(uuid4()), **node_headers}
        )
        assert ingest.status_code == 201

        resp = client.get(
            f"/api/v1/nodes/geo?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["total"] == 1
        item = payload["data"][0]
        assert item["id"] == sample_node.id
        assert item["irrigation_area_id"] == sample_irrigation_area.id
        assert item["last_reading_timestamp"] is not None
        assert item["minutes_since_last_reading"] is not None
        assert item["freshness_status"] in {"fresh", "stale"}

    def test_geo_client_scope_is_limited_to_own_nodes(
        self,
        client,
        client_headers,
        admin_headers,
        sample_crop_type,
        sample_node,
    ):
        self._create_other_client_area_and_node(client, admin_headers, sample_crop_type)

        resp = client.get(
            "/api/v1/nodes/geo?include_without_coordinates=true",
            headers=client_headers,
        )
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["total"] == 1
        assert payload["data"][0]["id"] == sample_node.id

    def test_geo_client_rejects_foreign_property_filter(
        self,
        client,
        client_headers,
        admin_headers,
        sample_crop_type,
    ):
        foreign = self._create_other_client_area_and_node(
            client,
            admin_headers,
            sample_crop_type,
        )

        resp = client.get(
            f"/api/v1/nodes/geo?property_id={foreign['property_id']}",
            headers=client_headers,
        )
        assert resp.status_code == 403

    def test_geo_client_rejects_foreign_area_filter(
        self,
        client,
        client_headers,
        admin_headers,
        sample_crop_type,
    ):
        foreign = self._create_other_client_area_and_node(
            client,
            admin_headers,
            sample_crop_type,
        )

        resp = client.get(
            f"/api/v1/nodes/geo?irrigation_area_id={foreign['area_id']}",
            headers=client_headers,
        )
        assert resp.status_code == 403

    def test_geo_excludes_nodes_without_coordinates_by_default(
        self,
        client,
        admin_headers,
        sample_property,
        sample_crop_type,
    ):
        area_resp = client.post(
            "/api/v1/irrigation-areas",
            json={
                "property_id": sample_property.id,
                "crop_type_id": sample_crop_type.id,
                "name": "Area Sin GPS",
            },
            headers=admin_headers,
        )
        assert area_resp.status_code == 201
        area_id = area_resp.json()["id"]

        node_resp = client.post(
            "/api/v1/nodes",
            json={"irrigation_area_id": area_id, "name": "Nodo Sin GPS"},
            headers=admin_headers,
        )
        assert node_resp.status_code == 201
        node_id = node_resp.json()["id"]

        resp_default = client.get("/api/v1/nodes/geo", headers=admin_headers)
        assert resp_default.status_code == 200
        ids_default = {item["id"] for item in resp_default.json()["data"]}
        assert node_id not in ids_default

        resp_with_no_coords = client.get(
            "/api/v1/nodes/geo?include_without_coordinates=true",
            headers=admin_headers,
        )
        assert resp_with_no_coords.status_code == 200
        ids_with_no_coords = {item["id"] for item in resp_with_no_coords.json()["data"]}
        assert node_id in ids_with_no_coords
