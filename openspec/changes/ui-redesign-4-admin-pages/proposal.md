# Change: ui-redesign-4-admin-pages

## Agent start

Owner: JP (`@jpDLG101`). This folder is the brief. Implement `tasks.md`; nothing else.
Binding rules: **`docs/ui-redesign-rules.md`** (what may and must not change, vocabulary,
accessibility, tests, PR evidence). Read it first, then `docs/design-system.md` and the files in
Scope. Visual decisions are yours; behavior, data, routes and names are not.

Depends on: `ui-redesign-3-history-export-map` merged (see Start gate); JP does the four changes
in order, one PR at a time.

## Start gate

Order and gates for all changes of this round: `docs/team-ronda-1.md`.

Do **not** start until the issue of `ui-redesign-3-history-export-map` is closed **and** its PR is merged into `main`. If the gate is
closed, stop: do not write code for this change.

## Why

The admin builds the whole hierarchy (cliente → predio → área → nodo, catálogo, ciclos). These
pages should feel like the focused *Equipos* page: a clear list, one primary action, forms that
ask only what is needed, and technical data out of the way.

## Scope

Allowed: `frontend/src/app/pages/admin/AdminDashboard.tsx`, `ClientManagement.tsx`,
`PropertyManagement.tsx`, `IrrigationAreaManagement.tsx`, `CropTypeManagement.tsx`,
`CropCycleManagement.tsx`, `NodeManagement.tsx`, `NodeDetail.tsx`, `DashboardPreferences.tsx`,
`AdminMapPage.tsx`; `GatewayManagement.tsx`, `GatewayDetail.tsx`, `PairDevice.tsx` and the
shared components this change owns in `docs/ui-redesign-rules.md` §2b (`PairingApprovalPanel`,
`EquipoStateBadge`, `RevokeLinkButton`) **only to align them with the documented patterns**
(keep their flow, steps, states and texts); colocated tests. `MetricCard` and
`FreshnessIndicator` belong to change 2: use them, do not edit them.

Exclude: `ThresholdManagement.tsx`, `AuditLogsPage.tsx`, `AIAssistantUsagePage.tsx` and every
alerts/AI page (Phase 2); the «Configurar Umbrales» and «Ver Auditoría» links on
`AdminDashboard.tsx` stay as they are; `services/`, `types/`, `utils/`, routes, backend.

## Non-goals

No new admin capabilities, no bulk actions, no change to validation rules or required fields.

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
