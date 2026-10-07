# Change: integration-c2-reading-idempotency

## Agent start

Owner: Ricky. This folder is the brief. Depends on C1 merged on `main`.

Read this folder, named contracts/evidence, and every Allowed/Scope path in this proposal (those are the files to edit or read):

- `contracts/edge-cloud/v1/telemetry.schema.json`
- `contracts/edge-cloud/v1/README.md`

Do not follow `docs/integration/week-plan.md` or Agro.io as the brief. Implement `tasks.md`. Stop if C1 is not merged or if blocked. PR `Closes #N` when an issue exists; the issue names this folder only.

## Why

`POST /api/v1/readings` must accept exact retries without duplicate rows and reject same-ID body conflicts.

## Scope

Allowed: `backend/app/api/v1/endpoints/readings.py`, `backend/app/services/reading.py`, `backend/app/models/reading.py`, `backend/app/schemas/reading.py`, `backend/alembic/versions/`, focused tests under `backend/tests/`.

Exclude: NDVI (no event-ID), serializer redesign, frontend, contracts, weather, deployment.

## Non-goals

Do not apply idempotency to NDVI. Do not redo C1.

## Verification

```bash
cd backend && python -m pytest tests/integration/test_readings_api.py tests/integration/test_permissions.py -q
cd backend && python -m ruff check app/api/v1/endpoints/readings.py app/services/reading.py app/models/reading.py app/schemas/reading.py tests/integration/test_readings_api.py
```
