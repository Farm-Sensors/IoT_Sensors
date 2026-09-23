# Keep MySQL 8 for gateway provisioning

For `edge-cloud-gateway-provisioning`, **stay on MySQL 8**. PostgreSQL is not the better pre-implementation choice under the stated priorities (simple operations, future integrations, time-series IoT). Switching engines before this change would add a full stack cutover without unlocking required uniqueness or ingest behavior.

This spike does not authorize implementation. It does not imply proposal readiness.

## Quick path

1. Keep `mysql:8.0`, `mysql+pymysql`, Alembic history, and Dokploy Compose as they are.
2. Design new gateway tables with **portable uniqueness** (composite unique keys; no PostgreSQL-only partial indexes or JSONB operators).
3. Treat time-range partitioning of `lecturas` as a later ops decision: both engines require the partition key in every unique/primary key, which collides with event-id uniqueness unless the unique key is redesigned.
4. Do not introduce TimescaleDB or other extensions.

## Details

| Topic | Decision |
|-------|----------|
| Engine | Keep MySQL 8 |
| Why | Lowest ops cost; required constraints are feasible; neither engine is a time-series store without extensions |
| PostgreSQL | Better JSONB/partial-index ergonomics, not needed for this change; migration cost is high |
| Partitioning | Same unique-key rule on both engines; current `lecturas` PK is `id` only |
| Tests | Suite stays SQLite in-memory; engine switch would not be proven by current tests |
| Scope | Evidence for design; no code, compose, or migration changes in this spike |

### Priorities (how they were scored)

| Priority | MySQL 8 | PostgreSQL (no extensions) |
|----------|---------|----------------------------|
| Simple operations | Wins: already in Compose, Dokploy, Alembic, config, SRS, docs | Lose: new image, volume, driver, URL, docs/SRS, data reload |
| Future integrations | Adequate: SQLAlchemy JSON facade, CHECK, composite UNIQUE | Slightly richer JSONB; not required for gateway/config/idempotency |
| Time-series IoT | Adequate: existing `(nodo_id, marca_tiempo)` + `marca_tiempo` indexes; 144 rows/node/day | Same class of B-tree indexes; partitioning PK rule is equivalent |

### Current repository facts

Verified in this worktree (not vendor docs):

- Runtime URL is `mysql+pymysql://...` (`backend/app/core/config.py`); engine uses `pool_pre_ping` (`backend/app/db/session.py`).
- Compose service is `mysql:8.0` with volume `mysql_data` (`docker-compose.yml`). Same image in `.devcontainer/docker-compose.yml`.
- Backend depends on `pymysql` only; no `psycopg` (`backend/pyproject.toml`).
- Alembic `env.py` binds `settings.DATABASE_URL` with no dialect branch.
- Nine revision files exist. `7a66ef728239_flatten_reading.py` imports `sqlalchemy.dialects.mysql` (`BIGINT`, `DECIMAL`, `TINYINT`, `mysql_engine=InnoDB`).
- `nodos`: unique `area_riego_id`, `api_key`, `numero_serie` (`backend/app/models/node.py`; init migration `e26372e1d878`).
- `lecturas`: PK `id` (BIGINT), required `marca_tiempo`, unique index `uq_lecturas_nodo_event_id` on `(nodo_id, event_id)` (`backend/app/models/reading.py`).
- Idempotency migration comment: historical `event_id` stays NULL; **MySQL unique index allows multiple NULLs** (`backend/alembic/versions/d4a8c2e67190_add_reading_event_id.py`).
- NDVI is a separate one-row-per-area table `ndvi_ultimos` PK `area_riego_id` with CHECKs (`c2f7a1d94e30`, `backend/app/models/ndvi_snapshot.py`). Not telemetry.
- Tests: `sqlite:///:memory:` plus BigInteger→INTEGER compiler and `PRAGMA foreign_keys=ON` (`backend/tests/conftest.py`, `docs/testing.md`).
- Stack contract is MySQL 8: `docs/stack.md`, `openspec/config.yaml`, `AGENTS.md`, SRS REQ-Diseño-02 (indexes now; partitioning later when volume grows).
- `docs/deployment.md`: acceptance is greenfield empty MySQL + `alembic upgrade head`. After go-live, destructive rewrite is forbidden without copy-and-verify.

Exploration already required this spike and forbade choosing the engine without evidence (`openspec/changes/edge-cloud-gateway-provisioning/exploration.md`).

### Constraint feasibility (new gateway model)

Target identities from exploration (not yet implemented): one gateway per property; versioned config; historical bindings; idempotency keyed by **gateway + logical node + event id**.

| Need | MySQL 8 | PostgreSQL (core only) | Exact feasibility |
|------|---------|------------------------|-------------------|
| Gateway ↔ property 1:1 | `UNIQUE(predio_id)` same pattern as `nodos.area_riego_id` | Same | **Both.** No partition interaction. |
| Versioned configuration | `UNIQUE(predio_id, version)` + SQLAlchemy `JSON` (MySQL JSON since 5.7) | Same, or explicit `JSONB` | **Both.** Prefer generic `JSON` so SQLite tests still create tables. |
| Historical node bindings + one active bind | No partial unique indexes. Use a **generated column** that is NULL when unbound, plus UNIQUE (InnoDB allows multiple NULLs), or keep a separate `active_bindings` table | Partial `UNIQUE (nodo_id) WHERE unbound_at IS NULL` is cleaner | **Both feasible.** MySQL needs a portable encoding; do not design a PG-only partial index if staying on MySQL. |
| Idempotent events `(gateway_id, logical_node_id, event_id)` | Composite unique, same as `uq_lecturas_nodo_event_id` | Same | **Both.** New rows should store non-null `event_id` so NULL-unique behavior is irrelevant. Re-keying C2 from node-only is a product/contract change, not an engine change. |
| Timestamped readings | Unpartitioned table + existing indexes | Same | **Both today.** Volume (144/node/day) does not require partitioning for this change. |
| NDVI snapshots | PK `area_riego_id` latest-point only | Same | **Both.** Not a time-series table. |

### Partitioning vs uniqueness (documented vendor rules)

Orchestrator-supplied primary-doc excerpts (this runtime **denied web fetch**; excerpts were not re-downloaded here):

- PostgreSQL declarative range partitioning supports partitioned indexes; unique constraints on partitioned tables must include the partition key (`https://www.postgresql.org/docs/current/ddl-partitioning.html`, `https://www.postgresql.org/docs/current/sql-createtable.html`).
- MySQL 8 `RANGE COLUMNS` supports `DATE`/`DATETIME`; every unique/primary key must include every partitioning column (`https://dev.mysql.com/doc/refman/8.0/en/partitioning-range.html`, `https://dev.mysql.com/doc/refman/8.0/en/partitioning-limitations-partitioning-keys-unique-keys.html`).

**Conclusion (inference, not a vendor sentence):** if `lecturas` is later partitioned by `marca_tiempo`, both engines force `marca_tiempo` into the PK and into `uq_lecturas_*_event_id`. That either weakens cross-partition idempotency or requires a **separate unpartitioned idempotency table**. That problem is engine-independent. It is not a reason to switch to PostgreSQL.

### Alembic / SQLAlchemy / Docker / tests — migration cost

| Surface | Stay MySQL | Switch to PostgreSQL |
|---------|------------|----------------------|
| Driver | Keep `pymysql` | Add `psycopg` (or equivalent); change `DATABASE_URL` |
| Alembic | Continue linear revisions | Replay or squash 9 revisions; rewrite `mysql.*` types, `sa.Enum` native types, `server_default=sa.text('now()')` |
| Compose / Dokploy | No change | Replace `mysql` service, healthcheck, volume; Traefik still fronts HTTP only |
| Data | None for this spike | Dump/reload even on greenfield-if-already-seeded; after go-live, `docs/deployment.md` forbids casual rewrite |
| Tests | Existing SQLite shims | Still SQLite; **would not prove** PG enums, JSONB, partial indexes, or `NULLS NOT DISTINCT` |
| Docs / SRS | No engine rewrite | Stack, architecture, SRS, operations, AGENTS.md |

SQLAlchemy 2.0 documents a generic `JSON` type that maps to MySQL JSON and PostgreSQL JSON; `JSONB` is PostgreSQL-specific (`https://docs.sqlalchemy.org/en/20/core/type_basics.html`, `https://docs.sqlalchemy.org/en/20/dialects/mysql.html`, `https://docs.sqlalchemy.org/en/20/dialects/postgresql.html`). Alembic renders types per dialect (`https://alembic.sqlalchemy.org/en/latest/api/ddl.html`).

**Cost judgment:** a PostgreSQL cutover is a **separate high-cost change**. Doing it *inside* gateway provisioning inflates risk without making gateway uniqueness possible. Doing it *later*, after new tables exist, is the exploration risk; that is an argument to **not switch later casually**, not an argument to switch now.

## Evidence classes

| Class | What |
|-------|------|
| Documented fact (repo) | Paths and constraints listed above |
| Documented fact (vendor, supplied or Context7) | Partition unique-key rules; SQLAlchemy JSON/JSONB; Alembic dialect rendering |
| Conclusion | Stay on MySQL 8; portable uniqueness; partitioning is orthogonal |
| Assumption | Acceptance MySQL may already hold seed data; no live row counts were measured |
| Out of scope | TimescaleDB, Citus, MySQL HeatWave, LISTEN/NOTIFY as a product requirement |

## Gaps

- Web access was denied in this runtime; PostgreSQL/MySQL pages were not independently re-fetched.
- No trial `alembic upgrade head` against PostgreSQL.
- No measured `lecturas` row counts or ingest latency.
- SQLite unique-NULL behavior was not re-tested in this spike (suite already uses SQLite).
- Agro.io’s own database is not in this repository.

## Checklist

- [x] Current engine, compose, Alembic, and test dialect identified
- [x] Gateway uniqueness, config versions, bindings, idempotency, readings, NDVI assessed
- [x] Partition unique-key rule compared on both engines without assuming extensions
- [x] Migration cost separated from “nice to have” PostgreSQL features
- [x] Web-fetch gap disclosed

## Next step

Use this recommendation in `sdd-design` (after an accepted proposal): model `gateways`, versioned config, binding history, and ingest idempotency as ordinary MySQL 8 unique keys. Do not open an engine-migration workstream unless operations later demand partitioning *and* choose an idempotency design that still needs a different engine — which current vendor rules do not show.
