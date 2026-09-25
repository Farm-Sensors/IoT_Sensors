"""Integration tests for /api/v1/thresholds and /api/v1/alerts."""

from uuid import uuid4
import hashlib

from datetime import UTC, datetime, timedelta

from app.core.config import settings
from app.core.security import hash_password
from app.models.client import Client
from app.models.irrigation_area import IrrigationArea
from app.models.node import Node
from app.models.property import Property
from app.models.user import User
from app.models.gateway import Gateway
from app.models.gateway_config import GatewayConfig
from app.models.gateway_slot import GatewaySlot
from app.services import alert as alert_service

SENSOR_PAYLOAD = {
    "timestamp": "2026-04-01T10:00:00Z",
    "soil": {
        "conductivity": 2.5,
        "temperature": 22.3,
        "humidity": 45.6,
        "water_potential": -0.8,
    },
    "irrigation": {
        "active": True,
        "accumulated_liters": 1250.0,
        "flow_per_minute": 8.3,
    },
    "environmental": {
        "temperature": 28.1,
        "relative_humidity": 55.0,
        "wind_speed": 12.5,
        "solar_radiation": 650.0,
        "eto": 5.2,
    },
}


class TestThresholdsApi:
    def _create_foreign_area(self, db, crop_type_id: int):
        foreign_user = User(
            correo="cliente_umbral_externo@test.com",
            contrasena_hash=hash_password("cliente2pass"),
            nombre_completo="Cliente Umbral Externo",
            rol="cliente",
            activo=True,
        )
        db.add(foreign_user)
        db.flush()

        foreign_client = Client(
            usuario_id=foreign_user.id,
            nombre_empresa="Empresa Externa Umbral",
            telefono="555-0003",
            direccion="Calle Externa 789",
        )
        db.add(foreign_client)
        db.flush()

        foreign_property = Property(
            cliente_id=foreign_client.id,
            nombre="Rancho Externo Umbral",
            ubicacion="Durango, MX",
        )
        db.add(foreign_property)
        db.flush()

        foreign_area = IrrigationArea(
            predio_id=foreign_property.id,
            tipo_cultivo_id=crop_type_id,
            nombre="Area Externa Umbral",
            tamano_area=5.0,
        )
        db.add(foreign_area)
        db.commit()
        db.refresh(foreign_area)
        return foreign_area

    def test_admin_can_create_threshold(
        self,
        client,
        admin_headers,
        sample_irrigation_area,
    ):
        resp = client.post(
            "/api/v1/thresholds",
            headers=admin_headers,
            json={
                "irrigation_area_id": sample_irrigation_area.id,
                "parameter": "soil.humidity",
                "min_value": 40.0,
                "max_value": 80.0,
                "severity": "warning",
                "active": True,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["irrigation_area_id"] == sample_irrigation_area.id
        assert data["parameter"] == "soil.humidity"

    def test_client_can_create_threshold_on_owned_area(
        self,
        client,
        client_headers,
        sample_irrigation_area,
    ):
        resp = client.post(
            "/api/v1/thresholds",
            headers=client_headers,
            json={
                "irrigation_area_id": sample_irrigation_area.id,
                "parameter": "soil.humidity",
                "min_value": 40.0,
                "severity": "warning",
            },
        )
        assert resp.status_code == 201

    def test_client_cannot_create_threshold_on_foreign_area(
        self,
        client,
        db,
        admin_headers,
        client_headers,
        sample_crop_type,
    ):
        foreign_area = self._create_foreign_area(db, sample_crop_type.id)
        resp = client.post(
            "/api/v1/thresholds",
            headers=client_headers,
            json={
                "irrigation_area_id": foreign_area.id,
                "parameter": "soil.humidity",
                "min_value": 35.0,
                "severity": "warning",
            },
        )
        assert resp.status_code == 403

    def test_cannot_create_duplicate_threshold(
        self,
        client,
        admin_headers,
        sample_irrigation_area,
    ):
        payload = {
            "irrigation_area_id": sample_irrigation_area.id,
            "parameter": "environmental.eto",
            "max_value": 7.0,
            "severity": "critical",
        }
        first = client.post("/api/v1/thresholds", headers=admin_headers, json=payload)
        assert first.status_code == 201

        second = client.post("/api/v1/thresholds", headers=admin_headers, json=payload)
        assert second.status_code == 409

    def test_client_lists_only_owned_thresholds(
        self,
        client,
        db,
        admin_headers,
        client_headers,
        sample_irrigation_area,
        sample_crop_type,
    ):
        own = client.post(
            "/api/v1/thresholds",
            headers=admin_headers,
            json={
                "irrigation_area_id": sample_irrigation_area.id,
                "parameter": "soil.humidity",
                "min_value": 40.0,
                "severity": "warning",
            },
        )
        assert own.status_code == 201

        foreign_area = self._create_foreign_area(db, sample_crop_type.id)
        foreign = client.post(
            "/api/v1/thresholds",
            headers=admin_headers,
            json={
                "irrigation_area_id": foreign_area.id,
                "parameter": "environmental.eto",
                "max_value": 8.0,
                "severity": "critical",
            },
        )
        assert foreign.status_code == 201

        resp = client.get("/api/v1/thresholds", headers=client_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["data"][0]["irrigation_area_id"] == sample_irrigation_area.id

    def test_client_can_get_update_delete_own_threshold(
        self,
        client,
        admin_headers,
        client_headers,
        sample_irrigation_area,
    ):
        created = client.post(
            "/api/v1/thresholds",
            headers=admin_headers,
            json={
                "irrigation_area_id": sample_irrigation_area.id,
                "parameter": "environmental.wind_speed",
                "max_value": 20.0,
                "severity": "warning",
            },
        )
        assert created.status_code == 201
        threshold_id = created.json()["id"]

        get_resp = client.get(
            f"/api/v1/thresholds/{threshold_id}", headers=client_headers
        )
        assert get_resp.status_code == 200

        put_resp = client.put(
            f"/api/v1/thresholds/{threshold_id}",
            headers=client_headers,
            json={"max_value": 25.0},
        )
        assert put_resp.status_code == 200

        del_resp = client.delete(
            f"/api/v1/thresholds/{threshold_id}", headers=client_headers
        )
        assert del_resp.status_code == 200

    def test_client_cannot_get_update_delete_foreign_threshold(
        self,
        client,
        db,
        admin_headers,
        client_headers,
        sample_crop_type,
    ):
        foreign_area = self._create_foreign_area(db, sample_crop_type.id)
        created = client.post(
            "/api/v1/thresholds",
            headers=admin_headers,
            json={
                "irrigation_area_id": foreign_area.id,
                "parameter": "environmental.wind_speed",
                "max_value": 20.0,
                "severity": "warning",
            },
        )
        assert created.status_code == 201
        threshold_id = created.json()["id"]

        get_resp = client.get(
            f"/api/v1/thresholds/{threshold_id}", headers=client_headers
        )
        assert get_resp.status_code == 403

        put_resp = client.put(
            f"/api/v1/thresholds/{threshold_id}",
            headers=client_headers,
            json={"max_value": 25.0},
        )
        assert put_resp.status_code == 403

        del_resp = client.delete(
            f"/api/v1/thresholds/{threshold_id}", headers=client_headers
        )
        assert del_resp.status_code == 403


class TestAlertsApi:
    def _create_foreign_area_node(self, db, crop_type_id: int):
        """Área/nodo que no pertenecen al cliente por defecto de la fixture."""
        foreign_user = User(
            correo="cliente2@test.com",
            contrasena_hash=hash_password("cliente2pass"),
            nombre_completo="Cliente Dos",
            rol="cliente",
            activo=True,
        )
        db.add(foreign_user)
        db.flush()

        foreign_client = Client(
            usuario_id=foreign_user.id,
            nombre_empresa="Empresa Dos",
            telefono="555-0002",
            direccion="Calle Dos 456",
        )
        db.add(foreign_client)
        db.flush()

        foreign_property = Property(
            cliente_id=foreign_client.id,
            nombre="Rancho Externo",
            ubicacion="Sonora, MX",
        )
        db.add(foreign_property)
        db.flush()

        foreign_area = IrrigationArea(
            predio_id=foreign_property.id,
            tipo_cultivo_id=crop_type_id,
            nombre="Area Externa",
            tamano_area=7.0,
        )
        db.add(foreign_area)
        db.flush()

        foreign_node = Node(
            area_riego_id=foreign_area.id,
            api_key="ak_foreign_node_001",
            nombre="Nodo Externo",
            latitud=27.0000,
            longitud=-108.0000,
            activo=True,
        )
        db.add(foreign_node)
        db.flush()
        credential = "gk_foreign_alerts_gateway"
        gateway = Gateway(
            predio_id=foreign_property.id,
            estado="active",
            credencial_hash=hashlib.sha256(credential.encode()).hexdigest(),
            credencial_prefijo=credential[:12],
            config_version_activa=1,
        )
        db.add(gateway)
        db.flush()
        slot = GatewaySlot(
            pasarela_id=gateway.id,
            nodo_id=foreign_node.id,
            area_riego_id=foreign_area.id,
        )
        db.add(slot)
        db.flush()
        db.add(
            GatewayConfig(
                predio_id=foreign_property.id,
                pasarela_id=gateway.id,
                version=1,
                snapshot={
                    "gateway_id": gateway.id,
                    "property_id": foreign_property.id,
                    "slots": [
                        {
                            "slot_id": slot.id,
                            "logical_node_id": foreign_node.id,
                            "irrigation_area_id": foreign_area.id,
                            "hardware_profile_code": None,
                        }
                    ],
                },
            )
        )
        db.commit()
        db.refresh(foreign_area)
        db.refresh(foreign_node)
        return foreign_area, foreign_node, {
            "X-API-Key": credential,
            "X-Logical-Node-Id": str(foreign_node.id),
        }

    def _create_threshold(
        self,
        client,
        admin_headers,
        area_id,
        severity: str = "critical",
    ):
        resp = client.post(
            "/api/v1/thresholds",
            headers=admin_headers,
            json={
                "irrigation_area_id": area_id,
                "parameter": "soil.humidity",
                "min_value": 50.0,
                "severity": severity,
            },
        )
        assert resp.status_code == 201
        return resp.json()

    def _create_threshold_alert(
        self,
        client,
        admin_headers,
        node_headers,
        area_id: int,
        *,
        timestamp: str = "2026-04-02T09:00:00Z",
        humidity: float = 35.0,
    ) -> int:
        self._create_threshold(client, admin_headers, area_id)
        ingest = client.post(
            "/api/v1/readings",
            headers={"X-Event-ID": str(uuid4()), **node_headers},
            json={
                **SENSOR_PAYLOAD,
                "timestamp": timestamp,
                "soil": {
                    **SENSOR_PAYLOAD["soil"],
                    "humidity": humidity,
                },
            },
        )
        assert ingest.status_code == 201

        list_resp = client.get(
            f"/api/v1/alerts?irrigation_area_id={area_id}",
            headers=admin_headers,
        )
        assert list_resp.status_code == 200
        assert list_resp.json()["total"] >= 1
        return list_resp.json()["data"][0]["id"]

    def test_ingest_breach_creates_alert(
        self,
        client,
        admin_headers,
        node_headers,
        sample_irrigation_area,
    ):
        self._create_threshold(client, admin_headers, sample_irrigation_area.id)

        payload = {
            **SENSOR_PAYLOAD,
            "timestamp": "2026-04-01T11:00:00Z",
            "soil": {
                **SENSOR_PAYLOAD["soil"],
                "humidity": 35.0,
            },
        }
        ingest = client.post("/api/v1/readings", headers={"X-Event-ID": str(uuid4()), **node_headers}, json=payload)
        assert ingest.status_code == 201

        list_resp = client.get(
            f"/api/v1/alerts?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert list_resp.status_code == 200
        data = list_resp.json()
        assert data["total"] == 1
        alert = data["data"][0]
        assert alert["type"] == "threshold"
        assert alert["parameter"] == "soil.humidity"
        assert alert["severity"] == "critical"

    def test_ingest_breach_with_alerts_disabled_creates_no_alert(
        self,
        client,
        admin_headers,
        node_headers,
        sample_irrigation_area,
        monkeypatch,
    ):
        monkeypatch.setattr(settings, "ALERTS_ENABLED", False)
        self._create_threshold(client, admin_headers, sample_irrigation_area.id)

        payload = {
            **SENSOR_PAYLOAD,
            "timestamp": "2026-04-01T11:00:00Z",
            "soil": {
                **SENSOR_PAYLOAD["soil"],
                "humidity": 35.0,
            },
        }
        ingest = client.post("/api/v1/readings", headers={"X-Event-ID": str(uuid4()), **node_headers}, json=payload)
        assert ingest.status_code == 201

        list_resp = client.get(
            f"/api/v1/alerts?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert list_resp.status_code == 200
        assert list_resp.json()["total"] == 0

    def test_duplicate_alerts_are_deduplicated_in_10_minutes_window(
        self,
        client,
        admin_headers,
        node_headers,
        sample_irrigation_area,
    ):
        self._create_threshold(client, admin_headers, sample_irrigation_area.id)

        payload1 = {
            **SENSOR_PAYLOAD,
            "timestamp": "2026-04-01T12:00:00Z",
            "soil": {
                **SENSOR_PAYLOAD["soil"],
                "humidity": 30.0,
            },
        }
        payload2 = {
            **SENSOR_PAYLOAD,
            "timestamp": "2026-04-01T12:05:00Z",
            "soil": {
                **SENSOR_PAYLOAD["soil"],
                "humidity": 32.0,
            },
        }

        first = client.post("/api/v1/readings", headers={"X-Event-ID": str(uuid4()), **node_headers}, json=payload1)
        second = client.post("/api/v1/readings", headers={"X-Event-ID": str(uuid4()), **node_headers}, json=payload2)
        assert first.status_code == 201
        assert second.status_code == 201

        list_resp = client.get(
            f"/api/v1/alerts?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert list_resp.status_code == 200
        assert list_resp.json()["total"] == 1

    def test_mark_alert_read(
        self,
        client,
        admin_headers,
        node_headers,
        sample_irrigation_area,
    ):
        self._create_threshold(client, admin_headers, sample_irrigation_area.id)

        payload = {
            **SENSOR_PAYLOAD,
            "timestamp": "2026-04-01T13:00:00Z",
            "soil": {
                **SENSOR_PAYLOAD["soil"],
                "humidity": 33.0,
            },
        }
        ingest = client.post("/api/v1/readings", headers={"X-Event-ID": str(uuid4()), **node_headers}, json=payload)
        assert ingest.status_code == 201

        list_resp = client.get(
            f"/api/v1/alerts?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        alert_id = list_resp.json()["data"][0]["id"]

        patch_resp = client.patch(
            f"/api/v1/alerts/{alert_id}/read",
            headers=admin_headers,
            json={"read": True},
        )
        assert patch_resp.status_code == 200
        updated = patch_resp.json()
        assert updated["read"] is True
        assert updated["read_at"] is not None

    def test_generate_alert_recommendation_returns_and_caches_result(
        self,
        client,
        admin_headers,
        sample_irrigation_area,
        node_headers,
    ):
        alert_id = self._create_threshold_alert(
            client,
            admin_headers,
            node_headers,
            sample_irrigation_area.id,
            timestamp="2026-04-02T10:00:00Z",
            humidity=34.0,
        )

        first_resp = client.post(
            f"/api/v1/alerts/{alert_id}/recommendation",
            headers=admin_headers,
            json={"force": False},
        )
        assert first_resp.status_code == 200
        first_data = first_resp.json()
        assert first_data["alert_id"] == alert_id
        assert first_data["recommendation"]
        assert first_data["source"] in {"ai", "fallback"}

        detail_resp = client.get(f"/api/v1/alerts/{alert_id}", headers=admin_headers)
        assert detail_resp.status_code == 200
        detail_data = detail_resp.json()
        assert detail_data["ai_recommendation"]
        assert detail_data["ai_recommendation_generated_at"] is not None

        cached_resp = client.post(
            f"/api/v1/alerts/{alert_id}/recommendation",
            headers=admin_headers,
            json={"force": False},
        )
        assert cached_resp.status_code == 200
        cached_data = cached_resp.json()
        assert cached_data["alert_id"] == alert_id
        assert cached_data["source"] in {"cached_ai", "cached_fallback"}
        assert cached_data["recommendation"] == first_data["recommendation"]

    def test_client_cannot_generate_recommendation_for_foreign_alert(
        self,
        client,
        db,
        admin_headers,
        client_headers,
        sample_crop_type,
    ):
        foreign_area, foreign_node, foreign_headers = self._create_foreign_area_node(
            db, sample_crop_type.id
        )
        self._create_threshold(client, admin_headers, foreign_area.id)

        ingest = client.post(
            "/api/v1/readings",
            headers={"X-Event-ID": str(uuid4()), **foreign_headers},
            json={
                **SENSOR_PAYLOAD,
                "timestamp": "2026-04-02T11:00:00Z",
                "soil": {
                    **SENSOR_PAYLOAD["soil"],
                    "humidity": 32.0,
                },
            },
        )
        assert ingest.status_code == 201

        alerts_resp = client.get(
            f"/api/v1/alerts?irrigation_area_id={foreign_area.id}",
            headers=admin_headers,
        )
        assert alerts_resp.status_code == 200
        alert_id = alerts_resp.json()["data"][0]["id"]

        forbidden_resp = client.post(
            f"/api/v1/alerts/{alert_id}/recommendation",
            headers=client_headers,
            json={"force": False},
        )
        assert forbidden_resp.status_code == 403

    def test_client_cannot_access_foreign_alert_detail_or_mark_read(
        self,
        client,
        db,
        admin_headers,
        client_headers,
        sample_crop_type,
    ):
        foreign_area, foreign_node, foreign_headers = self._create_foreign_area_node(
            db, sample_crop_type.id
        )

        threshold_resp = client.post(
            "/api/v1/thresholds",
            headers=admin_headers,
            json={
                "irrigation_area_id": foreign_area.id,
                "parameter": "soil.humidity",
                "min_value": 50.0,
                "severity": "critical",
            },
        )
        assert threshold_resp.status_code == 201

        payload = {
            **SENSOR_PAYLOAD,
            "timestamp": "2026-04-01T15:00:00Z",
            "soil": {
                **SENSOR_PAYLOAD["soil"],
                "humidity": 35.0,
            },
        }
        ingest = client.post(
            "/api/v1/readings",
            headers={"X-Event-ID": str(uuid4()), **foreign_headers},
            json=payload,
        )
        assert ingest.status_code == 201

        alerts_resp = client.get(
            f"/api/v1/alerts?irrigation_area_id={foreign_area.id}",
            headers=admin_headers,
        )
        assert alerts_resp.status_code == 200
        assert alerts_resp.json()["total"] >= 1
        alert_id = alerts_resp.json()["data"][0]["id"]

        detail_forbidden = client.get(
            f"/api/v1/alerts/{alert_id}", headers=client_headers
        )
        assert detail_forbidden.status_code == 403

        mark_forbidden = client.patch(
            f"/api/v1/alerts/{alert_id}/read",
            headers=client_headers,
            json={"read": True},
        )
        assert mark_forbidden.status_code == 403

    def test_unread_count_admin_gets_global_count(
        self,
        client,
        db,
        admin_headers,
        node_headers,
        sample_irrigation_area,
        sample_crop_type,
    ):
        self._create_threshold(client, admin_headers, sample_irrigation_area.id)

        own_ingest = client.post(
            "/api/v1/readings",
            headers={"X-Event-ID": str(uuid4()), **node_headers},
            json={
                **SENSOR_PAYLOAD,
                "timestamp": "2026-04-03T10:00:00Z",
                "soil": {
                    **SENSOR_PAYLOAD["soil"],
                    "humidity": 35.0,
                },
            },
        )
        assert own_ingest.status_code == 201

        foreign_area, foreign_node, foreign_headers = self._create_foreign_area_node(
            db, sample_crop_type.id
        )
        self._create_threshold(client, admin_headers, foreign_area.id)
        foreign_ingest = client.post(
            "/api/v1/readings",
            headers={"X-Event-ID": str(uuid4()), **foreign_headers},
            json={
                **SENSOR_PAYLOAD,
                "timestamp": "2026-04-03T10:05:00Z",
                "soil": {
                    **SENSOR_PAYLOAD["soil"],
                    "humidity": 30.0,
                },
            },
        )
        assert foreign_ingest.status_code == 201

        count_resp = client.get(
            "/api/v1/alerts/unread-count",
            headers=admin_headers,
        )
        assert count_resp.status_code == 200
        assert count_resp.json()["unread_count"] == 2

    def test_unread_count_client_is_scoped_to_owned_areas(
        self,
        client,
        db,
        admin_headers,
        client_headers,
        node_headers,
        sample_irrigation_area,
        sample_crop_type,
    ):
        self._create_threshold(client, admin_headers, sample_irrigation_area.id)

        own_ingest = client.post(
            "/api/v1/readings",
            headers={"X-Event-ID": str(uuid4()), **node_headers},
            json={
                **SENSOR_PAYLOAD,
                "timestamp": "2026-04-04T10:00:00Z",
                "soil": {
                    **SENSOR_PAYLOAD["soil"],
                    "humidity": 34.0,
                },
            },
        )
        assert own_ingest.status_code == 201

        foreign_area, foreign_node, foreign_headers = self._create_foreign_area_node(
            db, sample_crop_type.id
        )
        self._create_threshold(client, admin_headers, foreign_area.id)
        foreign_ingest = client.post(
            "/api/v1/readings",
            headers={"X-Event-ID": str(uuid4()), **foreign_headers},
            json={
                **SENSOR_PAYLOAD,
                "timestamp": "2026-04-04T10:05:00Z",
                "soil": {
                    **SENSOR_PAYLOAD["soil"],
                    "humidity": 31.0,
                },
            },
        )
        assert foreign_ingest.status_code == 201

        own_count_resp = client.get(
            "/api/v1/alerts/unread-count",
            headers=client_headers,
        )
        assert own_count_resp.status_code == 200
        assert own_count_resp.json()["unread_count"] == 1

        forbidden_count_resp = client.get(
            f"/api/v1/alerts/unread-count?irrigation_area_id={foreign_area.id}",
            headers=client_headers,
        )
        assert forbidden_count_resp.status_code == 403


class TestInactivityAlertsApi:
    def _iso_utc(self, dt: datetime) -> str:
        return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")

    def test_admin_scan_creates_inactivity_alert_for_stale_node(
        self,
        client,
        admin_headers,
        node_headers,
        sample_irrigation_area,
    ):
        stale_ts = datetime.now(UTC) - timedelta(minutes=30)
        ingest = client.post(
            "/api/v1/readings",
            headers={"X-Event-ID": str(uuid4()), **node_headers},
            json={
                **SENSOR_PAYLOAD,
                "timestamp": self._iso_utc(stale_ts),
            },
        )
        assert ingest.status_code == 201

        scan_resp = client.post(
            "/api/v1/alerts/scan-inactivity?minutes_without_data=20",
            headers=admin_headers,
        )
        assert scan_resp.status_code == 200
        summary = scan_resp.json()
        assert summary["scanned_nodes"] == 1
        assert summary["inactive_nodes"] == 1
        assert summary["created_alerts"] == 1

        list_resp = client.get(
            f"/api/v1/alerts?irrigation_area_id={sample_irrigation_area.id}&alert_type=inactivity",
            headers=admin_headers,
        )
        assert list_resp.status_code == 200
        assert list_resp.json()["total"] == 1

    def test_scan_does_not_duplicate_same_outage(
        self,
        client,
        admin_headers,
        node_headers,
    ):
        stale_ts = datetime.now(UTC) - timedelta(minutes=35)
        ingest = client.post(
            "/api/v1/readings",
            headers={"X-Event-ID": str(uuid4()), **node_headers},
            json={
                **SENSOR_PAYLOAD,
                "timestamp": self._iso_utc(stale_ts),
            },
        )
        assert ingest.status_code == 201

        first_scan = client.post(
            "/api/v1/alerts/scan-inactivity?minutes_without_data=20",
            headers=admin_headers,
        )
        second_scan = client.post(
            "/api/v1/alerts/scan-inactivity?minutes_without_data=20",
            headers=admin_headers,
        )
        assert first_scan.status_code == 200
        assert second_scan.status_code == 200
        assert first_scan.json()["created_alerts"] == 1
        assert second_scan.json()["created_alerts"] == 0

    def test_scan_skips_recent_node(
        self,
        client,
        admin_headers,
        node_headers,
    ):
        recent_ts = datetime.now(UTC) - timedelta(minutes=5)
        ingest = client.post(
            "/api/v1/readings",
            headers={"X-Event-ID": str(uuid4()), **node_headers},
            json={
                **SENSOR_PAYLOAD,
                "timestamp": self._iso_utc(recent_ts),
            },
        )
        assert ingest.status_code == 201

        scan_resp = client.post(
            "/api/v1/alerts/scan-inactivity?minutes_without_data=20",
            headers=admin_headers,
        )
        assert scan_resp.status_code == 200
        summary = scan_resp.json()
        assert summary["scanned_nodes"] == 1
        assert summary["inactive_nodes"] == 0
        assert summary["created_alerts"] == 0

    def test_client_cannot_scan_inactivity(
        self,
        client,
        client_headers,
    ):
        resp = client.post(
            "/api/v1/alerts/scan-inactivity?minutes_without_data=20",
            headers=client_headers,
        )
        assert resp.status_code == 403


class TestAlertNotificationDispatchApi:
    def test_admin_can_dispatch_notifications_disabled_noop(
        self,
        client,
        admin_headers,
        monkeypatch,
    ):
        monkeypatch.setattr(settings, "NOTIFICATIONS_ENABLED", False)
        monkeypatch.setattr(settings, "NOTIFICATIONS_EMAIL_ENABLED", False)
        monkeypatch.setattr(settings, "NOTIFICATIONS_WHATSAPP_ENABLED", False)

        resp = client.post(
            "/api/v1/alerts/dispatch-notifications?limit=50&only_unread=true",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["notifications_enabled"] is False
        assert data["email_enabled"] is False
        assert data["whatsapp_enabled"] is False
        assert data["processed_alerts"] == 0
        assert data["emailed_alerts"] == 0
        assert data["whatsapp_alerts"] == 0

    def test_client_cannot_dispatch_notifications(
        self,
        client,
        client_headers,
    ):
        resp = client.post(
            "/api/v1/alerts/dispatch-notifications",
            headers=client_headers,
        )
        assert resp.status_code == 403

    def test_warning_dispatches_enabled_channels(
        self,
        client,
        admin_headers,
        node_headers,
        sample_irrigation_area,
        monkeypatch,
    ):
        monkeypatch.setattr(settings, "NOTIFICATIONS_ENABLED", True)
        monkeypatch.setattr(settings, "NOTIFICATIONS_EMAIL_ENABLED", True)
        monkeypatch.setattr(settings, "NOTIFICATIONS_WHATSAPP_ENABLED", True)

        calls = {"email": 0, "whatsapp": 0}

        def _fake_email(**_kwargs):
            calls["email"] += 1
            return True

        def _fake_whatsapp(**_kwargs):
            calls["whatsapp"] += 1
            return True

        monkeypatch.setattr(alert_service, "_send_email_notification", _fake_email)
        monkeypatch.setattr(
            alert_service, "_send_whatsapp_notification", _fake_whatsapp
        )

        threshold_resp = client.post(
            "/api/v1/thresholds",
            headers=admin_headers,
            json={
                "irrigation_area_id": sample_irrigation_area.id,
                "parameter": "soil.humidity",
                "min_value": 50.0,
                "severity": "warning",
            },
        )
        assert threshold_resp.status_code == 201

        ingest = client.post(
            "/api/v1/readings",
            headers={"X-Event-ID": str(uuid4()), **node_headers},
            json={
                **SENSOR_PAYLOAD,
                "timestamp": "2026-04-02T10:00:00Z",
                "soil": {
                    **SENSOR_PAYLOAD["soil"],
                    "humidity": 35.0,
                },
            },
        )
        assert ingest.status_code == 201

        dispatch = client.post(
            "/api/v1/alerts/dispatch-notifications?only_unread=true&limit=20",
            headers=admin_headers,
        )
        assert dispatch.status_code == 200
        data = dispatch.json()
        assert data["emailed_alerts"] == 1
        assert data["whatsapp_alerts"] == 1
        assert data["email_failures"] == 0
        assert data["whatsapp_failures"] == 0
        assert calls["email"] == 1
        assert calls["whatsapp"] == 1

        list_resp = client.get(
            f"/api/v1/alerts?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert list_resp.status_code == 200
        alert = list_resp.json()["data"][0]
        assert alert["severity"] == "warning"
        assert alert["notified_email"] is True
        assert alert["notified_whatsapp"] is True

    def test_critical_dispatches_enabled_channels(
        self,
        client,
        admin_headers,
        node_headers,
        sample_irrigation_area,
        monkeypatch,
    ):
        monkeypatch.setattr(settings, "NOTIFICATIONS_ENABLED", True)
        monkeypatch.setattr(settings, "NOTIFICATIONS_EMAIL_ENABLED", True)
        monkeypatch.setattr(settings, "NOTIFICATIONS_WHATSAPP_ENABLED", True)

        calls = {"email": 0, "whatsapp": 0}

        def _fake_email(**_kwargs):
            calls["email"] += 1
            return True

        def _fake_whatsapp(**_kwargs):
            calls["whatsapp"] += 1
            return True

        monkeypatch.setattr(alert_service, "_send_email_notification", _fake_email)
        monkeypatch.setattr(
            alert_service, "_send_whatsapp_notification", _fake_whatsapp
        )

        threshold_resp = client.post(
            "/api/v1/thresholds",
            headers=admin_headers,
            json={
                "irrigation_area_id": sample_irrigation_area.id,
                "parameter": "soil.humidity",
                "min_value": 50.0,
                "severity": "critical",
            },
        )
        assert threshold_resp.status_code == 201

        ingest = client.post(
            "/api/v1/readings",
            headers={"X-Event-ID": str(uuid4()), **node_headers},
            json={
                **SENSOR_PAYLOAD,
                "timestamp": "2026-04-02T11:00:00Z",
                "soil": {
                    **SENSOR_PAYLOAD["soil"],
                    "humidity": 34.0,
                },
            },
        )
        assert ingest.status_code == 201

        dispatch = client.post(
            "/api/v1/alerts/dispatch-notifications?only_unread=true&limit=20",
            headers=admin_headers,
        )
        assert dispatch.status_code == 200
        data = dispatch.json()
        assert data["emailed_alerts"] == 1
        assert data["whatsapp_alerts"] == 1
        assert data["email_failures"] == 0
        assert data["whatsapp_failures"] == 0
        assert calls["email"] == 1
        assert calls["whatsapp"] == 1

        list_resp = client.get(
            f"/api/v1/alerts?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert list_resp.status_code == 200
        alert = list_resp.json()["data"][0]
        assert alert["severity"] == "critical"
        assert alert["notified_email"] is True
        assert alert["notified_whatsapp"] is True
