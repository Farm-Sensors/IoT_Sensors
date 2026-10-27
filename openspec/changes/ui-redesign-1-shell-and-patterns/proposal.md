# Change: ui-redesign-1-shell-and-patterns

## Agent start

Owner: JP (`@jpDLG101`). This folder is the brief. Implement `tasks.md`; nothing else.
Binding rules: **`docs/ui-redesign-rules.md`** (what may and must not change, vocabulary,
accessibility, tests, PR evidence). Read it first, then `docs/design-system.md` and the files in
Scope. Visual decisions are yours; behavior, data, routes and names are not.

First of four redesign changes, done in order 1 → 2 → 3 → 4 (`docs/team-ronda-1.md`); each
later one reuses the patterns this one defines.

## Start gate

Order and gates for all changes of this round: `docs/team-ronda-1.md`.

This change has no prerequisite; it is one of the first of the round.

## Why

Pages today mix many blocks of text with the same visual weight, so the eye has nowhere to land
(the admin *Equipos* page was fixed on 2026-10-26 for that reason: see
`frontend/src/app/pages/admin/GatewayManagement.tsx` and `GatewayDetail.tsx` as the reference of
"focused" layout: list with status badges, one primary action, details behind a disclosure).
This change sets the frame every page lives in (login, navigation, page header, shared
components and tokens) and writes the patterns down so the next three changes apply them the
same way.

## Scope

Allowed: `frontend/src/app/pages/auth/LoginPage.tsx`, `frontend/src/app/components/auth/`,
`frontend/src/app/layouts/`, `frontend/src/app/components/navigation/DesktopSidebar.tsx`,
`MobileTabBar.tsx` (and in `items.ts` only `icon` and the order of entries **without** a
`module` field; entries with `module` keep their relative position; never change `path`,
`label`, `mobileLabel` or `module`), `frontend/src/app/pages/client/ProfilePage.tsx`, the shared
components this change owns in `docs/ui-redesign-rules.md` §2b (`ui/`, `PillButton`,
`BentoCard`, `EmptyState`, `ConfirmDialog`, `Toast`, `SkeletonCard`, `MetricSkeleton`,
`AnimatedBackground`, `PageTransition`, `icons/`, `auth/`, `navigation/`), `frontend/src/styles/theme.css`, `docs/design-system.md`, colocated tests.

Exclude: everything under `frontend/src/app/pages/` not listed, `services/`, `types/`, routes,
`ForgotPasswordPage.tsx` / `ResetPasswordPage.tsx` and the «¿Olvidé mi contraseña?» link
(Phase 2, keep as is), backend.

## Non-goals

No new pages, no navigation entries added or removed, no change to which entries a role sees.

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
