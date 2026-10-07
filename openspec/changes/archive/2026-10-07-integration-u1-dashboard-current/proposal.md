# Change: integration-u1-dashboard-current

## Agent start

Owner: Fabián. This folder is the brief. Frontend only. C1 is not required to start.

Read this folder, named contracts/evidence, and every Allowed/Scope path in this proposal (those are the files to edit or read):

- `docs/integration/frontend-evidence/` (weather/NDVI 200 fixtures)
- `openapi.yaml` (current readings paths)

Tolerate current nullable OpenAPI categories until C1 merges. Weather/NDVI cards use the frozen 200 fixtures; errors use existing UI error state (no extra fixtures). Freshness may reuse `FRESH_MINUTES_THRESHOLD` mapped to current/stale; do not invent a vocabulary that fights `helpers.ts`.

Do not follow `docs/integration/week-plan.md` or Agro.io as the brief. Implement `tasks.md`. Stop if blocked. Do not change backend. PR `Closes #N` when an issue exists; the issue names this folder only.

## Why

The client dashboard must show current telemetry, freshness, and weather/latest-NDVI cards from frozen 200 fixtures (separate provenance, not telemetry).

## Scope

Allowed: `frontend/src/app/pages/client/dashboard/`, `frontend/src/app/pages/client/ClientDashboard.tsx`, relevant `frontend/src/app/components/`, `services/`, `types/`, colocated frontend tests.

Exclude: backend, contracts, admin, alerts expansion, maps, AI, deployment, invented API behavior.

## Non-goals

No backend. Weather and NDVI stay separate provenance streams.

## Verification

```bash
cd frontend && npm test -- --run
cd frontend && npm run typecheck
```
