"""Integration tests for GET /api/v1/settings/modules."""

import pytest

from app.core.config import settings

URL = "/api/v1/settings/modules"
FLAGS = {
    "alerts": "ALERTS_ENABLED",
    "ai_assistant": "AI_ASSISTANT_ENABLED",
    "ai_reports": "AI_REPORTS_ENABLED",
    "notifications": "NOTIFICATIONS_ENABLED",
}


def test_requires_authentication(client):
    assert client.get(URL).status_code == 401


@pytest.mark.parametrize("headers_fixture", ["admin_headers", "client_headers"])
def test_all_off_by_default_for_any_role(client, request, headers_fixture, monkeypatch):
    for flag in FLAGS.values():
        monkeypatch.setattr(settings, flag, False)
    response = client.get(URL, headers=request.getfixturevalue(headers_fixture))
    assert response.status_code == 200
    assert response.json() == {key: False for key in FLAGS}


@pytest.mark.parametrize("key", list(FLAGS))
def test_each_value_follows_its_flag(client, client_headers, monkeypatch, key):
    for flag in FLAGS.values():
        monkeypatch.setattr(settings, flag, False)
    monkeypatch.setattr(settings, FLAGS[key], True)
    response = client.get(URL, headers=client_headers)
    assert response.status_code == 200
    assert response.json() == {name: name == key for name in FLAGS}
