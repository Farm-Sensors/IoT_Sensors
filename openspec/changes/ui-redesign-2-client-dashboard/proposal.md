# Change: ui-redesign-2-client-dashboard

## Agent start

Owner: JP (`@jpDLG101`). This folder is the brief. Implement `tasks.md`; nothing else.
Binding rules: **`docs/ui-redesign-rules.md`** (what may and must not change, vocabulary,
accessibility, tests, PR evidence). Read it first, then `docs/design-system.md` and the files in
Scope. Visual decisions are yours; behavior, data, routes and names are not.

Depends on: `ui-redesign-1-shell-and-patterns` merged (use its «Patrones de pantalla»).

## Start gate

Order and gates for all changes of this round: `docs/team-ronda-1.md`.

Do **not** start until the issue of `ui-redesign-1-shell-and-patterns` is closed **and** `docs/design-system.md` on `origin/main` contains the section «Patrones de pantalla». If the gate is
closed, stop: do not write code for this change.

## Why

The client dashboard is the screen the client opens every day. Observed on the local stack
(2026-10-27): the stale-data line ("Sin reporte reciente · Último dato: … · hace 20 min") is
repeated on the top bar and inside each priority card, making the screen read heavier than the
data it shows. The client must see at a glance: which predio and área, whether data is current,
and the three priority values.

## Scope

Allowed: `frontend/src/app/pages/client/ClientDashboard.tsx`,
`frontend/src/app/pages/client/dashboard/` (except `SemaphorePill.tsx`, Phase 2),
`frontend/src/app/pages/client/AreaSelector.tsx`, `PropertyDetail.tsx`, and the shared
components this change owns in `docs/ui-redesign-rules.md` §2b: `MetricCard.tsx`,
`FreshnessIndicator.tsx` (look only), `GatewayStatusBadge.tsx`,
`selection/SelectionScopeBar.tsx` (look only); `docs/design-system.md` §7 rule 2; colocated
tests.

Exclude: logic in `dashboard/readings.ts`, `dashboard/helpers.ts` and `FreshnessIndicator.tsx`
(values, null handling, freshness math), `services/`, `types/`, `utils/`, the semaphore and
anything alerts-related, backend. `MetricCard` and `FreshnessIndicator` are also rendered on
admin pages (change 4) and `SelectionScopeBar` on Phase 2 pages; those pages change only as a
side effect.

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
