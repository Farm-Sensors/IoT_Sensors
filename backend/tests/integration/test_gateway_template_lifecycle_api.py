from app.models import GatewayTemplate, GatewayTemplateVersion


def _template(db, *, template_status="draft", version_statuses=("draft",)):
    template = GatewayTemplate(nombre="Ranch template", estado=template_status)
    db.add(template)
    db.flush()
    versions = [
        GatewayTemplateVersion(
            plantilla_id=template.id,
            version=number,
            estado=state,
            definicion={"slots": [{"area_name": f"Area {number}"}]},
        )
        for number, state in enumerate(version_statuses, start=1)
    ]
    db.add_all(versions)
    db.commit()
    return template, versions


def test_admin_activates_draft_version_without_mutating_other_active_version(
    client, db, admin_headers
):
    template, versions = _template(db, version_statuses=("active", "draft"))
    response = client.post(
        f"/api/v1/gateway-templates/{template.id}/versions/{versions[1].id}/activate",
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert response.json() == {
        "template_id": template.id,
        "template_status": "active",
        "version_id": versions[1].id,
        "version": 2,
        "version_status": "active",
    }
    assert versions[0].estado == "active"
    assert versions[1].estado == "active"


def test_retiring_last_active_version_returns_template_to_draft(client, db, admin_headers):
    template, versions = _template(db, template_status="active", version_statuses=("active",))
    response = client.post(
        f"/api/v1/gateway-templates/{template.id}/versions/{versions[0].id}/retire",
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert versions[0].estado == "retired"
    assert template.estado == "draft"


def test_retiring_template_retires_all_versions_and_prevents_reactivation(
    client, db, admin_headers
):
    template, versions = _template(
        db, template_status="active", version_statuses=("active", "draft")
    )
    retired = client.post(
        f"/api/v1/gateway-templates/{template.id}/retire", headers=admin_headers
    )
    assert retired.status_code == 200
    assert template.estado == "retired"
    assert [version.estado for version in versions] == ["retired", "retired"]
    activate = client.post(
        f"/api/v1/gateway-templates/{template.id}/versions/{versions[1].id}/activate",
        headers=admin_headers,
    )
    assert activate.status_code == 409


def test_template_lifecycle_requires_admin(client, db, client_headers):
    template, versions = _template(db)
    response = client.post(
        f"/api/v1/gateway-templates/{template.id}/versions/{versions[0].id}/activate",
        headers=client_headers,
    )
    assert response.status_code == 403
