> **Status: superseded (2026-10-02).** Event-ID idempotency shipped with the gateway cutover, scoped to gateway + logical node + `X-Event-ID` (not per-node API keys): migrations `d4a8c2e67190` and `e29a02c7b902`, `backend/app/api/v1/endpoints/readings.py:54-75`, tests in `backend/tests/integration/test_reading_concurrency.py`. Do not implement this brief as written; archive it with the gateway change.

# Tasks

- [ ] Confirm C1 is merged on `main`. Stop if it is not.
- [ ] Persist `X-Event-ID` on telemetry ingest, scoped to authenticated node + `POST /api/v1/readings`.
- [ ] Add an Alembic migration. First valid event: `201` and one row. Exact retry (same node, endpoint, ID, body): `200` and still one row.
- [ ] Same ID with a different body: `409` and no mutation. Missing/invalid API key or event ID: fail with no mutation.
- [ ] Add focused retry/conflict/concurrency tests. Run the proposal verification commands. PR `Closes #N` when an issue exists.
