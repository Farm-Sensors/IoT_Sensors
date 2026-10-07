# Change: integration-c1-reading-serializer

## Agent start

Owner: Ricky. This folder is the brief.

Read this folder, named contracts/evidence, and every Allowed/Scope path in this proposal (those are the files to edit or read):

- `contracts/edge-cloud/v1/telemetry.schema.json`

Do not use Agro.io as the brief. Implement `tasks.md`. Stop if blocked. PR `Closes #N` when an issue exists; the issue names this folder only.

## Why

GET history and latest can emit null category objects. Clients need the exact nested v1 12 fields and uppercase UTC `Z`.

## Scope

Allowed: `backend/app/schemas/reading.py`, `backend/app/api/v1/endpoints/readings.py`, focused tests under `backend/tests/`. Read-only if needed for ORM columns: `backend/app/models/reading.py` (do not edit).

Exclude: C2, NDVI, weather, frontend, contracts, migrations, auth, deployment.

## Non-goals

Do not change POST ingestion or export generation.

## Verification

```bash
cd backend && python -m pytest tests/integration/test_readings_api.py tests/unit/test_reading_service.py -q
cd backend && python -m ruff check app/schemas/reading.py app/api/v1/endpoints/readings.py tests/integration/test_readings_api.py
```
