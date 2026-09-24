"""Tests unitarios para app.services.node."""

import pytest
from fastapi import HTTPException

from app.schemas.node import NodeCreate, NodeUpdate
from app.services import node as node_service


class TestCreateNode:
    def test_create_success(self, db, sample_irrigation_area):
        data = NodeCreate(
            irrigation_area_id=sample_irrigation_area.id,
            name="Nodo A",
            serial_number="SN-001",
            latitude=28.6320,
            longitude=-106.0691,
        )
        node = node_service.create_node(db, data)
        assert node.id is not None
        assert node.nombre == "Nodo A"
        assert node.numero_serie == "SN-001"
        assert node.api_key is None

    def test_create_invalid_area_raises_404(self, db):
        data = NodeCreate(irrigation_area_id=99999, name="Sin Área")
        with pytest.raises(HTTPException) as exc:
            node_service.create_node(db, data)
        assert exc.value.status_code == 404

    def test_create_second_node_same_area_raises_409(self, db, sample_irrigation_area):
        """Relación 1:1 — un área solo puede tener un nodo."""
        node_service.create_node(
            db, NodeCreate(irrigation_area_id=sample_irrigation_area.id, name="Nodo 1")
        )
        with pytest.raises(HTTPException) as exc:
            node_service.create_node(
                db, NodeCreate(irrigation_area_id=sample_irrigation_area.id, name="Nodo 2")
            )
        assert exc.value.status_code == 409

    def test_new_nodes_do_not_receive_legacy_api_keys(self, db, sample_property, sample_crop_type):
        """New logical nodes do not receive direct machine credentials."""
        from app.models.irrigation_area import IrrigationArea

        area1 = IrrigationArea(
            predio_id=sample_property.id,
            tipo_cultivo_id=sample_crop_type.id,
            nombre="Área Única 1",
        )
        area2 = IrrigationArea(
            predio_id=sample_property.id,
            tipo_cultivo_id=sample_crop_type.id,
            nombre="Área Única 2",
        )
        db.add(area1)
        db.add(area2)
        db.commit()
        db.refresh(area1)
        db.refresh(area2)

        n1 = node_service.create_node(db, NodeCreate(irrigation_area_id=area1.id, name="N1"))
        n2 = node_service.create_node(db, NodeCreate(irrigation_area_id=area2.id, name="N2"))
        assert n1.api_key is None
        assert n2.api_key is None


class TestGetNode:
    def test_get_existing(self, db, sample_node):
        fetched = node_service.get_node(db, sample_node.id)
        assert fetched.id == sample_node.id

    def test_get_nonexistent_raises_404(self, db):
        with pytest.raises(HTTPException) as exc:
            node_service.get_node(db, 99999)
        assert exc.value.status_code == 404


class TestListNodes:
    def test_list_returns_node(self, db, sample_node):
        items, total = node_service.list_nodes(db, page=1, per_page=50)
        assert any(n.id == sample_node.id for n in items)

    def test_filter_by_irrigation_area(self, db, sample_node, sample_irrigation_area):
        items, total = node_service.list_nodes(
            db, page=1, per_page=50, irrigation_area_id=sample_irrigation_area.id
        )
        assert total == 1
        assert items[0].id == sample_node.id

    def test_soft_deleted_not_listed(self, db, sample_node):
        node_service.soft_delete_node(db, sample_node.id)
        items, total = node_service.list_nodes(db, page=1, per_page=50)
        assert not any(n.id == sample_node.id for n in items)


class TestUpdateNode:
    def test_update_name(self, db, sample_node):
        updated = node_service.update_node(db, sample_node.id, NodeUpdate(name="Nuevo Nodo"))
        assert updated.nombre == "Nuevo Nodo"

    def test_deactivate_node(self, db, sample_node):
        updated = node_service.update_node(db, sample_node.id, NodeUpdate(is_active=False))
        assert updated.activo is False

    def test_update_gps(self, db, sample_node):
        updated = node_service.update_node(
            db, sample_node.id, NodeUpdate(latitude=29.0, longitude=-107.0)
        )
        assert float(updated.latitud) == 29.0
        assert float(updated.longitud) == -107.0


class TestSoftDeleteNode:
    def test_soft_delete_deactivates(self, db, sample_node):
        node_service.soft_delete_node(db, sample_node.id)
        with pytest.raises(HTTPException) as exc:
            node_service.get_node(db, sample_node.id)
        assert exc.value.status_code == 404
