"""Force competing inserts using separate connections and persistent storage.

Defaults to SQLite. Set C2_TEST_DATABASE_URL to a disposable MySQL database
whose name starts with c2_test_ to exercise MySQL's unique-key race handling.
"""

import hashlib
import json
import os
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, func, insert, select
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import Base
from app.models.node import Node
from app.models.reading import Reading
from app.schemas.reading import ReadingCreate
from app.services import reading as service
from tests.integration.test_readings_api import SENSOR_PAYLOAD


@pytest.fixture
def isolated_engine(tmp_path, db, sample_node, monkeypatch):
    url = os.environ.get("C2_TEST_DATABASE_URL")
    if url:
        assert make_url(url).database.startswith("c2_test_"), "Use a disposable C2 test database"
    else:
        url = f"sqlite:///{tmp_path / 'events.db'}"
    engine = create_engine(url)
    monkeypatch.setattr(settings, "ALERTS_ENABLED", False)
    Base.metadata.create_all(engine)
    try:
        # Copy the fixture hierarchy into committed storage visible to both workers.
        with engine.begin() as connection:
            for table in Base.metadata.sorted_tables:
                rows = [dict(row) for row in db.execute(select(table)).mappings()]
                if rows:
                    connection.execute(insert(table), rows)
        yield engine, sample_node.id
    finally:
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.mark.parametrize("different_body", [False, True])
def test_simultaneous_events_have_one_winner(isolated_engine, monkeypatch, different_body):
    engine, node_id = isolated_engine
    barrier = Barrier(2, timeout=15)
    original = service.create_reading
    attempted = []

    def synchronized_insert(*args, **kwargs):
        # Both workers must observe no existing event before trying to insert.
        attempted.append(1)
        barrier.wait()
        return original(*args, **kwargs)

    monkeypatch.setattr(service, "create_reading", synchronized_insert)
    event_id = str(uuid4())

    def submit(index):
        payload = dict(SENSOR_PAYLOAD)
        if different_body and index:
            payload["timestamp"] = "2026-04-01T11:00:00Z"
        fingerprint = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        with Session(engine) as session:
            node = session.get(Node, node_id)
            try:
                reading, created = service.ingest_reading(
                    session, node, ReadingCreate.model_validate(payload), event_id, fingerprint
                )
                return (201 if created else 200), reading.id, fingerprint, payload
            except HTTPException as exc:
                return exc.status_code, None, fingerprint, payload

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(submit, range(2)))
    assert len(attempted) == 2
    assert sorted(result[0] for result in results) == ([201, 409] if different_body else [200, 201])
    winner = next(result for result in results if result[0] == 201)
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Reading)) == 1
        stored = session.scalar(select(Reading))
        assert stored.event_id == event_id
        assert stored.payload_hash == winner[2]
        # A fresh session sees the durable identity, not an in-memory cache.
        retry, created = service.ingest_reading(
            session,
            session.get(Node, node_id),
            ReadingCreate.model_validate(winner[3]),
            event_id,
            winner[2],
        )
        assert not created
        assert retry.id == winner[1]
    if not different_body:
        assert results[0][1] == results[1][1]


def test_unrelated_integrity_error_is_not_reported_as_retry(isolated_engine, monkeypatch):
    engine, node_id = isolated_engine

    def fail(*args, **kwargs):
        raise IntegrityError("insert", {}, ValueError("unrelated constraint"))

    monkeypatch.setattr(service, "create_reading", fail)
    with Session(engine) as session:
        with pytest.raises(IntegrityError):
            service.ingest_reading(
                session,
                session.get(Node, node_id),
                ReadingCreate.model_validate(SENSOR_PAYLOAD),
                str(uuid4()),
                "a" * 64,
            )
        assert session.scalar(select(func.count()).select_from(Reading)) == 0


def test_migration_preserves_history_and_enforces_unique_events(isolated_engine):
    import importlib.util
    from pathlib import Path

    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import inspect, text

    path = (
        Path(__file__).resolve().parents[2]
        / "alembic/versions"
        / "d4a8c2e67190_add_reading_event_id.py"
    )
    spec = importlib.util.spec_from_file_location("reading_event_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine, node_id = isolated_engine
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)) as operations:
            # This test exercises the historical C2 revision, not gateway v2.
            # The fixture uses current metadata: remove the later event index,
            # retaining a supporting index for the gateway FK on MySQL.
            operations.create_index("idx_test_legacy_gateway_fk", "lecturas", ["pasarela_id"])
            operations.drop_index("uq_lecturas_pasarela_nodo_event_id", table_name="lecturas")
            migration.downgrade()
            for _ in range(2):
                connection.execute(
                    text(
                        "INSERT INTO lecturas (nodo_id, marca_tiempo, suelo_humedad) "
                        "VALUES (:node_id, '2026-04-01 10:00:00', 0)"
                    ),
                    {"node_id": node_id},
                )
            migration.upgrade()
            rows = connection.execute(
                text("SELECT suelo_humedad, event_id, payload_hash FROM lecturas")
            ).all()
            assert rows == [(0, None, None), (0, None, None)]
            statement = text(
                "INSERT INTO lecturas (nodo_id, marca_tiempo, event_id, payload_hash) "
                "VALUES (:node_id, '2026-04-01 11:00:00', :event_id, :payload_hash)"
            )
            params = {"node_id": node_id, "event_id": str(uuid4()), "payload_hash": "a" * 64}
            connection.execute(statement, params)
            with pytest.raises(IntegrityError):
                with connection.begin_nested():
                    connection.execute(statement, params)
            assert connection.scalar(text("SELECT COUNT(*) FROM lecturas")) == 3
            migration.downgrade()
            columns = {column["name"] for column in inspect(connection).get_columns("lecturas")}
            assert "event_id" not in columns
            assert "payload_hash" not in columns
            assert connection.scalar(text("SELECT COUNT(*) FROM lecturas")) == 3
