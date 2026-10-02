# Feature: integration-catchup

## Objective
Unblock frontend verification, reconcile stale OpenSpec task lists with `main`, and implement the client-facing U1 (current dashboard) and U2 (history/export) changes.

## Problem / Why
- `npm run typecheck` fails (TS6133 in `frontend/src/app/pages/admin/NodeManagement.tsx:99`), which blocks the U1/U2 verification commands.
- `edge-cloud-gateway-provisioning` tasks 4.4/4.5 and `integration-c1`/`integration-c2` do not reflect code already on `main`.
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
- [x] T3 U1 dashboard current (`openspec/changes/integration-u1-dashboard-current/tasks.md`). Route: delegated writer (2+ non-trivial files).
- [x] T4 U2 history/export (`openspec/changes/integration-u2-history-export/tasks.md`), after T3 on `main`. Route: delegated writer.

## Checks
- `cd frontend && npm test -- --run`
- `cd frontend && npm run typecheck`
- Backend tests relevant to C1 (`backend/tests`), if runnable locally.

## Progress / Evidence
- T1: commit `42c39ad`. `npm run typecheck`: pass. `npx vitest run`: 12 files / 58 tests pass. Review assess: medium, `under_budget` (2 lines).
- T2: commit `3dccefa`. Gateway 4.4/4.5 and C1 items 1-4 checked with code/test evidence; C2 marked superseded. Backend pytest/ruff NOT run: pytest and ruff are not installed on this host (no venv). C1 verification task left unchecked.
- T3: delegated audit found all 4 U1 tasks already implemented on `main`; no source edits. vitest 58/58, typecheck pass. U1 tasks.md checked with evidence.
- T4: delegated audit found all U2 tasks already implemented on `main`; no source edits. vitest 58/58, typecheck pass. U2 tasks.md checked with evidence.

## Next step
User decisions: push to origin; install backend test tooling to verify C1/NDVI; Dokploy test stack; task 7.4 after Agro.io readiness; archive change folders.
