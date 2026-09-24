from app.models import (
    Gateway,
    GatewayConfig,
    GatewaySlot,
    GatewayTemplate,
    GatewayTemplateVersion,
    HardwareProfile,
    IrrigationArea,
    Node,
    PhysicalBinding,
)


def _copy_source(db, *, name="North Field", active=True, code="soil-v1"):
    profile = HardwareProfile(codigo=code, nombre="Soil profile", activo=True)
    template = GatewayTemplate(nombre="Standard", estado="active" if active else "draft")
    db.add_all([profile, template])
    db.flush()
    version = GatewayTemplateVersion(
        plantilla_id=template.id,
        version=1,
        estado="active" if active else "draft",
        definicion={
            "slots": [
                {"area_name": name, "hardware_profile_code": code},
            ]
        },
    )
    db.add(version)
    db.commit()
    return template, version, profile


def _area_and_node(db, sample_property, *, area_name="North Field"):
    from app.models import CropType

    crop = CropType(nombre=f"Crop {area_name}")
    db.add(crop)
    db.flush()
    area = IrrigationArea(
        predio_id=sample_property.id,
        tipo_cultivo_id=crop.id,
        nombre=area_name,
    )
    db.add(area)
    db.flush()
    node = Node(area_riego_id=area.id, activo=True)
    db.add(node)
    db.commit()
    return area, node


def test_copy_creates_isolated_existing_area_working_set_without_bindings(
    client, db, admin_headers, sample_property
):
    template, version, profile = _copy_source(db)
    area, node = _area_and_node(db, sample_property)
    gateway = Gateway(predio_id=sample_property.id)
    db.add(gateway)
    db.commit()
    db.refresh(gateway)

    response = client.post(
        f"/api/v1/gateway-templates/{template.id}/versions/{version.id}/copies",
        headers=admin_headers,
        json={"property_id": sample_property.id},
    )
    assert response.status_code == 200
    working_set = response.json()["working_set"]
    assert len(working_set) == 1
    assert working_set[0]["irrigation_area_id"] == area.id
    assert working_set[0]["logical_node_id"] == node.id
    assert working_set[0]["hardware_profile_id"] == profile.id
    assert working_set[0]["template_version_id"] == version.id
    assert db.query(PhysicalBinding).count() == 0
    assert db.query(Gateway).count() == 1
    assert db.query(IrrigationArea).count() == 1
    assert db.query(Node).count() == 1
    repeated = client.post(
        f"/api/v1/gateway-templates/{template.id}/versions/{version.id}/copies",
        headers=admin_headers,
        json={"property_id": sample_property.id},
    )
    assert repeated.status_code == 200
    assert repeated.json()["working_set"][0]["slot_id"] == working_set[0]["slot_id"]
    assert db.query(GatewaySlot).count() == 1

    version.definicion = {"slots": [{"area_name": "Changed later"}]}
    db.commit()
    slot = db.query(GatewaySlot).one()
    assert slot.area_riego_id == area.id
    assert slot.perfil_hardware_id == profile.id
    assert slot.version_plantilla_id == version.id


def test_copy_requires_active_template_existing_gateway_area_node_and_profile(
    client, db, admin_headers, sample_property
):
    template, version, _profile = _copy_source(db, name="Missing area")
    gateway = Gateway(predio_id=sample_property.id)
    db.add(gateway)
    db.commit()
    missing_area = client.post(
        f"/api/v1/gateway-templates/{template.id}/versions/{version.id}/copies",
        headers=admin_headers,
        json={"property_id": sample_property.id},
    )
    assert missing_area.status_code == 422
    assert db.query(GatewaySlot).count() == 0

    _area_and_node(db, sample_property)
    profile = db.query(HardwareProfile).filter_by(codigo="soil-v1").one()
    profile.activo = False
    db.commit()
    inactive_profile = client.post(
        f"/api/v1/gateway-templates/{template.id}/versions/{version.id}/copies",
        headers=admin_headers,
        json={"property_id": sample_property.id},
    )
    assert inactive_profile.status_code == 422
    assert db.query(GatewaySlot).count() == 0

    draft, draft_version, _ = _copy_source(db, name="Missing area", active=False, code="other-v1")
    inactive = client.post(
        f"/api/v1/gateway-templates/{draft.id}/versions/{draft_version.id}/copies",
        headers=admin_headers,
        json={"property_id": sample_property.id},
    )
    assert inactive.status_code == 409


def test_copy_does_not_create_missing_gateway_and_rejects_published_or_bound_sets(
    client, db, admin_headers, sample_property
):
    template, version, _profile = _copy_source(db)
    area, node = _area_and_node(db, sample_property)
    no_gateway = client.post(
        f"/api/v1/gateway-templates/{template.id}/versions/{version.id}/copies",
        headers=admin_headers,
        json={"property_id": sample_property.id},
    )
    assert no_gateway.status_code == 409
    assert db.query(Gateway).count() == 0

    gateway = Gateway(predio_id=sample_property.id)
    db.add(gateway)
    db.commit()
    db.refresh(gateway)
    slot = GatewaySlot(
        pasarela_id=gateway.id,
        area_riego_id=area.id,
        nodo_id=node.id,
        perfil_hardware_id=None,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    db.add(
        GatewayConfig(
            predio_id=sample_property.id,
            pasarela_id=gateway.id,
            version=1,
            snapshot={"slots": []},
        )
    )
    db.commit()
    published = client.post(
        f"/api/v1/gateway-templates/{template.id}/versions/{version.id}/copies",
        headers=admin_headers,
        json={"property_id": sample_property.id},
    )
    assert published.status_code == 409
    assert slot.version_plantilla_id is None
