# Feature: integration-catchup

## Objective
Unblock frontend verification, reconcile stale OpenSpec task lists with `main`, and implement the client-facing U1 (current dashboard) and U2 (history/export) changes.

## Problem / Why
- `npm run typecheck` fails (TS6133 in `frontend/src/app/pages/admin/NodeManagement.tsx:99`), which blocks the U1/U2 verification commands.
- `edge-cloud-gateway-provisioning` tasks 4.4/4.5 and `openspec/changes/archive/2026-10-08-integration-c1-reading-serializer/`/`openspec/changes/archive/2026-10-07-integration-c2-reading-idempotency/` do not reflect code already on `main`.
- U1/U2 (originally owned by Fabián) were authorized by the user to be implemented here.

## Scope
- Frontend fix, OpenSpec task status updates, U1 and U2 per their `openspec/changes/integration-u*/` briefs.
- Excluded: push, Dokploy stack, task 7.4 (waits on Agro.io), backend changes for U1/U2.

## Constraints
- Commits go directly to `main` (user decision, 2026-10-02). No push without explicit approval.
- U1/U2 are frontend-only; follow their proposal Scope/Allowed paths.

## Delivery strategy
`ask-on-risk`; commits on `main` per user instruction.

## Tasks
- [x] T1 Fix unused `res` in `NodeManagement.tsx` so `npm run typecheck` passes. Route: inline (one mechanical line).
- [x] T2 Reconcile OpenSpec task lists: mark gateway 4.4/4.5 with evidence; verify C1 against code/tests; mark C2 superseded with evidence. Route: inline (doc edits after verification).
- [x] T3 U1 dashboard current (`openspec/changes/archive/2026-10-07-integration-u1-dashboard-current/tasks.md`). Route: delegated writer (2+ non-trivial files).
- [x] T4 U2 history/export (`openspec/changes/archive/2026-10-07-integration-u2-history-export/tasks.md`), after T3 on `main`. Route: delegated writer.
- [x] T5 Verify C1 with real backend tooling and close its last task. Route: inline (one command set + evidence).
- [x] T6 Close gateway 7.4 with the real Raspberry validation and repair the stale `scripts/integration` H1 harness. Route: inline (harness migration + tests).
- [x] T7 Archive the finished change folders in both repositories and repoint every live reference. Route: inline (moves + reference edits).

## Checks
- `cd frontend && npm test -- --run`
- `cd frontend && npm run typecheck`
- Backend tests relevant to C1 (`backend/tests`), if runnable locally.

## Progress / Evidence
- T1: commit `42c39ad`. `npm run typecheck`: pass. `npx vitest run`: 12 files / 58 tests pass. Review assess: medium, `under_budget` (2 lines).
- T2: commit `3dccefa`. Gateway 4.4/4.5 and C1 items 1-4 checked with code/test evidence; C2 marked superseded. Backend pytest/ruff NOT run: pytest and ruff are not installed on this host (no venv). C1 verification task left unchecked.
- T3: delegated audit found all 4 U1 tasks already implemented on `main`; no source edits. vitest 58/58, typecheck pass. U1 tasks.md checked with evidence.
- T4: delegated audit found all U2 tasks already implemented on `main`; no source edits. vitest 58/58, typecheck pass. U2 tasks.md checked with evidence.
- T5: `backend/.venv` installed; `pytest tests/integration/test_readings_api.py` → 32 passed; full backend suite → 490 passed (`pytest -q --ignore=tests/mysql`). C1 last task checked; no issue names that folder and the code is already on `main`, so no PR.
- T6: real Raspberry validation on 2026-10-08 (device `10.32.90.229`, release `2.0.0-alpha.2`, gateway 7 / property 8): activation, configuration poll, binding, telemetry `201`/`200`, heartbeat `204`, 1,700+ readings in the dashboard. `scripts/integration` H1 harness migrated from the v1 manifest shape to `h1/v2`; `contract validator + h0 + h1 + v2` → 23 tests OK. Gateway 7.4 closed.
- T7: archived `edge-cloud-gateway-provisioning` and `integration-c1-reading-serializer` (IoT) plus `integration-e2/e3/e4` and `integration-edge-ndvi-publisher` (Agro.io) under `archive/2026-10-08-*`, with live references repointed.

## Next step
- Pushed both repositories to origin on 2026-10-08 (IoT `main`, Agro `integration/iot-v2`).
- Redeployed the private Dokploy stack on 2026-10-08: the gateway v2 flow and, later the same day, the pairing routes with `GATEWAY_PAIRING_ENABLED=true` and `PAIRING_VERIFICATION_BASE_URL` set in Dokploy (the variables only reach the backend because `docker-compose.yml` forwards them).
- Delivered and archived: `openspec/changes/archive/2026-10-08-gateway-device-pairing/` (InstallView pairing flow). Live acceptance verified on 2026-10-08 (approved session with credential rotation on the test Raspberry and the reference fallback re-checked through the harness).
