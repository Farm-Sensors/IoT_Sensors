"""Opt-in acceptance against an EMPTY, disposable MySQL 8 database.

GATEWAY_MYSQL_TEST_URL=mysql+pymysql://root@127.0.0.1:PORT/issue29_test
No databases are dropped or reused; the test refuses non-empty databases.
"""

import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError, OperationalError

from app.core.config import settings

PREVIOUS = "d4a8c2e67190"
PREVIOUS_GATEWAY_HEAD = "e29a03c7b903"
PREVIOUS_BEFORE_GATEWAY = "e29a02c7b902"
HEAD = "e29a05c7b905"
TABLES = {
    "pasarelas",
    "referencias_activacion",
    "perfiles_hardware",
    "plantillas_pasarela",
    "versiones_plantilla_pasarela",
    "ranuras_logicas",
    "configuraciones_pasarela",
    "vinculos_fisicos",
    "autorizaciones_actualizacion",
    "confirmaciones_actualizacion",
}


def test_mysql_empty_upgrade_legacy_preservation_constraints_and_rollback(monkeypatch):
    connection_url = os.environ.get("GATEWAY_MYSQL_TEST_URL")
    if not connection_url:
        pytest.skip("Requires an explicit empty disposable MySQL 8 database")
    url = make_url(connection_url)
    assert url.drivername == "mysql+pymysql"
    assert url.database and url.database.startswith("issue29_"), (
        "Use a disposable issue29_ database"
    )
    engine = create_engine(url)
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT VERSION()")).startswith("8.")
        assert inspect(connection).get_table_names() == [], "Refusing to reuse a non-empty database"
    for key, value in {
        "DB_HOST": url.host,
        "DB_PORT": url.port or 3306,
        "DB_USER": url.username,
        "DB_PASSWORD": url.password or "",
        "DB_NAME": url.database,
    }.items():
        monkeypatch.setattr(settings, key, value)
    backend = Path(__file__).resolve().parents[2]
    config = Config(str(backend / "alembic.ini"))
    config.set_main_option("script_location", str(backend / "alembic"))
    try:
        command.upgrade(config, "head")
        assert TABLES <= set(inspect(engine).get_table_names())
        command.downgrade(config, PREVIOUS)
        assert not TABLES & set(inspect(engine).get_table_names())
        with engine.begin() as c:
            c.execute(
                text(
                    "INSERT INTO usuarios (id,correo,contrasena_hash,nombre_completo,rol,activo) VALUES (1,'fixture@example.invalid','not-a-login','Fixture','admin',1)"
                )
            )
            c.execute(
                text("INSERT INTO clientes (id,usuario_id,nombre_empresa) VALUES (1,1,'Fixture')")
            )
            c.execute(
                text(
                    "INSERT INTO predios (id,cliente_id,nombre) VALUES (1,1,'Fixture'),(2,1,'Other')"
                )
            )
            c.execute(text("INSERT INTO tipos_cultivo (id,nombre) VALUES (1,'Fixture')"))
            c.execute(
                text(
                    "INSERT INTO areas_riego (id,predio_id,tipo_cultivo_id,nombre,tamano_area) VALUES (1,1,1,'Area',1),(2,1,1,'Second',1)"
                )
            )
            c.execute(
                text(
                    "INSERT INTO nodos (id,area_riego_id,api_key,activo) VALUES (1,1,'synthetic-legacy-key',1),(2,2,'synthetic-legacy-key-2',1)"
                )
            )
            c.execute(
                text(
                    "INSERT INTO lecturas (id,nodo_id,marca_tiempo,event_id) VALUES (1,1,'2026-09-23','historical-event')"
                )
            )
        command.upgrade(config, "head")
        indexes = {index["name"] for index in inspect(engine).get_indexes("lecturas")}
        assert "uq_lecturas_pasarela_nodo_event_id" in indexes
        assert "uq_lecturas_nodo_event_id" not in indexes
        with engine.begin() as c:
            assert c.execute(
                text(
                    "SELECT pasarela_id, marca_tiempo_sospechosa, event_id FROM lecturas WHERE id=1"
                )
            ).one() == (None, 0, "historical-event")
            assert c.scalar(text("SELECT api_key FROM nodos WHERE id=1")) == "synthetic-legacy-key"
            assert "ndvi_ultimos" in inspect(c).get_table_names()
            assert not any("ndvi" in col["name"] for col in inspect(c).get_columns("lecturas"))

            def reject(statement):
                # PyMySQL classifies CHECK violations as OperationalError (3819).
                with pytest.raises((IntegrityError, OperationalError)) as error, c.begin_nested():
                    c.execute(text(statement))
                assert error.value.orig.args[0] in {1062, 1452, 3819}

            c.execute(text("INSERT INTO pasarelas (id,predio_id) VALUES (1,1),(2,2)"))
            reject("INSERT INTO pasarelas (predio_id) VALUES (1)")
            c.execute(
                text(
                    "INSERT INTO configuraciones_pasarela (predio_id,pasarela_id,version,snapshot) VALUES (1,1,1,'{}')"
                )
            )
            reject(
                "INSERT INTO configuraciones_pasarela (predio_id,pasarela_id,version,snapshot) VALUES (1,1,1,'{}')"
            )
            reject(
                "INSERT INTO configuraciones_pasarela (predio_id,pasarela_id,version,snapshot) VALUES (2,1,1,'{}')"
            )
            c.execute(
                text(
                    "INSERT INTO ranuras_logicas (id,pasarela_id,nodo_id,area_riego_id) VALUES (1,1,1,1),(2,1,2,2)"
                )
            )
            insert_binding = "INSERT INTO vinculos_fisicos (pasarela_id,ranura_id,nodo_id,area_riego_id,uid,numero_serie,estado,confirmado_en,confirmado_por_pasarela_id) VALUES "
            confirmed = "(1,1,1,1,'synthetic-uid','serial','confirmed','2026-09-23',1)"
            c.execute(text(insert_binding + confirmed))
            reject(insert_binding + confirmed)
            reject(insert_binding + "(1,2,2,2,'synthetic-uid','serial','confirmed','2026-09-23',1)")
            reject(insert_binding + "(1,1,1,2,'different','serial','pending',NULL,NULL)")
            reject(insert_binding + "(1,2,2,2,'different','serial','confirmed','2026-09-23',2)")
            c.execute(
                text(
                    "UPDATE vinculos_fisicos SET estado='closed', cerrado_en='2026-09-24' WHERE id=1"
                )
            )
            c.execute(text(insert_binding + confirmed))
            assert c.scalar(text("SELECT COUNT(*) FROM vinculos_fisicos")) == 2
            assert (
                c.scalar(
                    text(
                        "SELECT COUNT(*) FROM vinculos_fisicos WHERE nodo_confirmado_id IS NOT NULL"
                    )
                )
                == 1
            )
            insert_pending = (
                "INSERT INTO vinculos_fisicos "
                "(pasarela_id,ranura_id,nodo_id,area_riego_id,uid,numero_serie,estado,"
                "evento_propuesta_id,hash_propuesta,estado_propuesta,evento_confirmacion_id,hash_confirmacion) "
                "VALUES (1,2,2,2,'candidate-uid','candidate-serial','pending',"
                "'proposal-1','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',"
                "'pending_initial','confirm-1',"
                "'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')"
            )
            c.execute(text(insert_pending))
            reject(
                insert_pending.replace("candidate-uid", "other-uid").replace(
                    "candidate-serial", "other-serial"
                )
            )
            duplicate_confirmation = insert_pending.replace("proposal-1", "proposal-2").replace(
                "candidate-uid", "other-uid"
            ).replace("candidate-serial", "other-serial")
            reject(duplicate_confirmation)
            reading = "INSERT INTO lecturas (nodo_id,pasarela_id,marca_tiempo,event_id) VALUES (1,1,'2026-09-23','gateway-event')"
            c.execute(text(reading))
            reject(reading)
            c.execute(
                text(
                    "INSERT INTO lecturas (nodo_id,pasarela_id,marca_tiempo,event_id) "
                    "VALUES (1,2,'2026-09-23','gateway-event')"
                )
            )
        with pytest.raises(RuntimeError, match="gateway-scoped event identities"):
            command.downgrade(config, PREVIOUS_GATEWAY_HEAD)
        with engine.begin() as c:
            c.execute(
                text(
                    "DELETE FROM lecturas WHERE nodo_id=1 AND pasarela_id=2 "
                    "AND event_id='gateway-event'"
                )
            )
            c.execute(
                text(
                    "INSERT INTO lecturas (nodo_id,pasarela_id,marca_tiempo,event_id) VALUES (2,1,'2026-09-23','gateway-event')"
                )
            )
            c.execute(text("UPDATE nodos SET api_key=NULL WHERE id=2"))
        with pytest.raises(RuntimeError, match="gateway binding retry identities"):
            command.downgrade(config, PREVIOUS)
        with engine.begin() as c:
            c.execute(
                text(
                    "UPDATE vinculos_fisicos SET evento_propuesta_id=NULL, hash_propuesta=NULL, "
                    "estado_propuesta=NULL, evento_confirmacion_id=NULL, hash_confirmacion=NULL"
                )
            )
        with pytest.raises(RuntimeError, match="gateway reading metadata"):
            command.downgrade(config, PREVIOUS)
        with engine.connect() as c:
            assert c.scalar(text("SELECT version_num FROM alembic_version")) == PREVIOUS_BEFORE_GATEWAY
            assert c.scalar(text("SELECT COUNT(*) FROM lecturas")) == 3
    finally:
        engine.dispose()
