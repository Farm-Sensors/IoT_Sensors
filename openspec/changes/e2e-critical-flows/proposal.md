# Change: e2e-critical-flows

## Agent start

Owner: Ricky (`@rickybecerra`). This folder is the brief. Implement `tasks.md`; nothing else.
Read first: `README.md` «Desarrollo Local», `docs/ui-redesign-rules.md`,
`frontend/src/app/routes.tsx`, `frontend/src/app/components/navigation/items.ts`, and the page
files named in `design.md`. Take every label, button name and heading **from those source
files**; never guess a text.

Depends on: `dev-one-command-stack` (see Start gate). The suite must not depend on how the stack
was started (`make dev` or the README manual steps 0–5).

## Start gate

Order and gates for all changes of this round: `docs/team-ronda-1.md`.

Do **not** start until the issue of `dev-one-command-stack` is closed **and** `git cat-file -e origin/main:scripts/dev_up.sh` succeeds. If the gate is
closed, stop: do not write code for this change.

## Why

A redesign of the whole web app is starting (`ui-redesign-*`). Behavior must not break while the
look changes. An end-to-end suite that drives the real app in a browser, through what users see
(roles, labels, text), is the safety net every redesign PR must pass.

## Scope

Allowed: `frontend/e2e/` (new), `frontend/playwright.config.ts` (new), `frontend/vite.config.ts`
(only to add `test.exclude: [...configDefaults.exclude, "e2e/**"]` so vitest skips `e2e/`), `frontend/package.json`
(devDependency `@playwright/test` and scripts `test:e2e`, `test:e2e:ui`), `frontend/package-lock.json`,
`frontend/.gitignore` (Playwright output and `e2e/.auth/`), `README.md` and `docs/operations.md` (how to run).

Exclude: app source under `frontend/src/` (no `data-testid` additions, no refactors), backend,
`docker-compose.yml`, any other vitest setting, CI workflows.

## Non-goals

No visual snapshot tests. No tests of Phase 2 pages (alerts, thresholds, notifications, AI,
audit, password reset) beyond `navigation.spec.ts` opening the always-visible «Auditoría» entry. No mocking of the API: the suite runs against the local stack.

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
make dev                     # or README steps 0–5
cd frontend && npx playwright install chromium
npm run test:e2e             # all green, twice in a row
npm test -- --run && npm run typecheck   # unchanged suites still green
```
