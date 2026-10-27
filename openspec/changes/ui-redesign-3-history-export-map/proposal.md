# Change: ui-redesign-3-history-export-map

## Agent start

Owner: JP (`@jpDLG101`). This folder is the brief. Implement `tasks.md`; nothing else.
Binding rules: **`docs/ui-redesign-rules.md`** (what may and must not change, vocabulary,
accessibility, tests, PR evidence). Read it first, then `docs/design-system.md` and the files in
Scope. Visual decisions are yours; behavior, data, routes and names are not.

Depends on: `ui-redesign-2-client-dashboard` merged (see Start gate).

## Start gate

Order and gates for all changes of this round: `docs/team-ronda-1.md`.

Do **not** start until the issue of `ui-redesign-2-client-dashboard` is closed **and** its PR is merged into `main`. If the gate is
closed, stop: do not write code for this change.

## Why

History, export and the map are how the client looks back and takes data out. Filters (date
presets, free range, crop cycle) and the export formats must be obvious and fast to use,
especially on a phone.

## Scope

Allowed: `frontend/src/app/pages/client/HistoricalData.tsx`, `ExportData.tsx`,
`ClientMapPage.tsx`, and the shared components this change owns in
`docs/ui-redesign-rules.md` §2b (`ReadingDateRangeSelector.tsx` look only, `ChartSkeleton.tsx`),
chart styling inside these pages, colocated tests.

Exclude: `services/useReadingFilters.ts`, `services/readings.ts`, `utils/readingFilters.ts`,
`utils/readingChart.ts`, `utils/export.ts` (filters, chart grouping, export), the inline `api.*`
calls in `ExportData.tsx` and `ReadingDateRangeSelector.tsx` (keep them byte-identical),
`components/maps/mapHelpers.ts` and `useGeoNodesData.ts` (data), `types/`, backend.
`ReadingDateRangeSelector` is also rendered on Phase 2 pages; they change only as a side effect.

## Git and PR (mandatory)

- Branch `feat/<issue-number>-<short-name>` from the latest `main` of `Farm-Sensors/IoT_Sensors`.
- Open the PR to `main` with `Closes #<issue-number>`. Never push to `main`; Alan reviews, merges
  and deploys to the lab.
- One logical change per commit; fix review findings by amending the commit they belong to.
- No access to the lab server (`10.32.81.230`) or the test Raspberry is available or needed. Do
  not add instructions, URLs or scripts that assume them.
- Update the docs named in `tasks.md` in the same PR. Docs describe the current state.
- If something you need is not written in this folder or the files it names, **stop** and ask in
  the issue instead of inventing it.

## Verification

```bash
make dev                        # or README «Desarrollo Local» steps 0–5
cd frontend && npm test -- --run && npm run typecheck && npm run build
npm run test:e2e                # once frontend/e2e/ exists on main
npm run test:a11y               # once a11y-automated-checks is on main
```
