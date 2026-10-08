# Tasks

- [x] Serialize GET `/api/v1/readings` and GET `/api/v1/readings/latest` with nested `soil`, `irrigation`, and `environmental` objects (never JSON `null`) and all 12 v1 fields. — `ReadingResponse.from_reading` (`backend/app/schemas/reading.py`). _(Evidence on `main`; backend tests not run on this host — pytest unavailable. 2026-10-02.)_
- [x] Emit `timestamp` as UTC ISO 8601 ending in uppercase `Z`. Do not leak ORM/Spanish column names. — `serialize_timestamp` emits `Z`; asserted in `test_readings_api.py:112`. _(Evidence on `main`; backend tests not run on this host — pytest unavailable. 2026-10-02.)_
- [x] Keep unavailable values as JSON `null`; keep measured `0`. Wrapper `id` / `node_id` may remain. — Nested response schemas keep nullable fields. _(Evidence on `main`; backend tests not run on this host — pytest unavailable. 2026-10-02.)_
- [x] Add focused tests for history and latest against `contracts/edge-cloud/v1/telemetry.schema.json` nested shape. — `test_readings_api.py:44` parametrizes history and `/latest`. _(Evidence on `main`; backend tests not run on this host — pytest unavailable. 2026-10-02.)_
- [ ] Run the proposal verification commands. Stay in allowed paths. PR `Closes #N` when an issue exists.
