# Change: integration-u2-history-export

## Agent start

Owner: Fabián. This folder is the brief. Depends on U1 merged on `main`. Frontend only.

Read this folder, named contracts/evidence, and every Allowed/Scope path in this proposal (those are the files to edit or read):

- `openapi.yaml` (GET `/api/v1/readings` and GET `/api/v1/readings/export`)

Do not follow `docs/integration/week-plan.md` or Agro.io as the brief. Implement `tasks.md`. Stop if U1 is not merged or if blocked. Do not generate exports in the backend. PR `Closes #N` when an issue exists; the issue names this folder only.

## Why

History and export UI must use existing list/export APIs with frontend date-range resolution.

## Scope

Allowed: `frontend/src/app/pages/client/HistoricalData.tsx`, `frontend/src/app/pages/client/ExportData.tsx`, `frontend/src/app/components/ReadingDateRangeSelector.tsx`, relevant `services/`, `utils/`, `types/`, colocated frontend tests.

Exclude: backend/export generation, contracts, dashboard redesign, admin, persistence, deployment, invented query/response behavior.

## Non-goals

No backend. Do not redo U1. Do not treat weather/NDVI as history.

## Verification

```bash
cd frontend && npm test -- --run
cd frontend && npm run typecheck
```
