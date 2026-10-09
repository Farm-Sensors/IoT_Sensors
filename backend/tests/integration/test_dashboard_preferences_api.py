from app.models import DashboardPreference

ME_PATH = "/api/v1/clients/me/dashboard-preferences"


def _admin_path(client_id):
    return f"/api/v1/clients/{client_id}/dashboard-preferences"


def test_admin_reads_default_and_saves_cards(client, db, admin_headers, client_headers, client_user):
    _, client_record = client_user
    path = _admin_path(client_record.id)

    default = client.get(path, headers=admin_headers)

    assert default.status_code == 200
    assert default.json() == {"client_id": client_record.id, "cards": None}

    saved = client.put(
        path,
        headers=admin_headers,
        json={"cards": ["priority.humidity", "soil.chart", "sources.external"]},
    )

    assert saved.status_code == 200
    assert saved.json() == {
        "client_id": client_record.id,
        "cards": ["priority.humidity", "soil.chart", "sources.external"],
    }
    assert client.get(path, headers=admin_headers).json() == saved.json()

    mine = client.get(ME_PATH, headers=client_headers)

    assert mine.status_code == 200
    assert mine.json() == saved.json()


def test_saving_again_replaces_the_selection(client, db, admin_headers, client_user):
    _, client_record = client_user
    path = _admin_path(client_record.id)
    client.put(path, headers=admin_headers, json={"cards": ["priority.humidity", "priority.flow"]})

    replaced = client.put(path, headers=admin_headers, json={"cards": ["priority.eto"]})

    assert replaced.json()["cards"] == ["priority.eto"]
    assert db.query(DashboardPreference).count() == 1


def test_duplicate_and_unknown_cards(client, db, admin_headers, client_user):
    _, client_record = client_user
    path = _admin_path(client_record.id)

    deduplicated = client.put(
        path, headers=admin_headers, json={"cards": ["soil.chart", "soil.chart"]}
    )
    unknown = client.put(
        path, headers=admin_headers, json={"cards": ["priority.humidity", "soil.magic"]}
    )

    assert deduplicated.json()["cards"] == ["soil.chart"]
    assert unknown.status_code == 422
    assert db.get(DashboardPreference, 1).tarjetas == ["soil.chart"]


def test_null_cards_go_back_to_the_automatic_dashboard(
    client, db, admin_headers, client_headers, client_user
):
    _, client_record = client_user
    path = _admin_path(client_record.id)
    client.put(path, headers=admin_headers, json={"cards": ["priority.eto"]})

    cleared = client.put(path, headers=admin_headers, json={"cards": None})

    assert cleared.status_code == 200
    assert cleared.json() == {"client_id": client_record.id, "cards": None}
    assert client.get(path, headers=admin_headers).json()["cards"] is None
    assert client.get(ME_PATH, headers=client_headers).json()["cards"] is None
    assert db.query(DashboardPreference).count() == 0


def test_roles_and_missing_clients_are_enforced(client, admin_headers, client_headers, client_user):
    _, client_record = client_user

    assert client.get(_admin_path(client_record.id), headers=client_headers).status_code == 403
    assert (
        client.put(
            _admin_path(client_record.id), headers=client_headers, json={"cards": []}
        ).status_code
        == 403
    )
    assert client.get(_admin_path(99999), headers=admin_headers).status_code == 404
    assert (
        client.put(_admin_path(99999), headers=admin_headers, json={"cards": []}).status_code
        == 404
    )
    assert client.get(ME_PATH, headers=admin_headers).status_code == 403
