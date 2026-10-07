"""The committed openapi.yaml must match the schema generated from the FastAPI app."""

import json
from pathlib import Path

import pytest

from app.main import app

yaml = pytest.importorskip("yaml")

OPENAPI_FILE = Path(__file__).resolve().parents[3] / "openapi.yaml"


def test_committed_openapi_matches_app_schema():
    committed = yaml.safe_load(OPENAPI_FILE.read_text(encoding="utf-8"))
    generated = json.loads(json.dumps(app.openapi()))
    assert committed == generated, "openapi.yaml is stale: run `make openapi-sync`"
