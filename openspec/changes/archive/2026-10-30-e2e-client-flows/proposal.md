# Change: e2e-client-flows

## Agent start

Owner: Fabián (`@fabianfugg`). This folder is the brief. Implement `tasks.md`; nothing else.
Read first: `openspec/changes/e2e-critical-flows/design.md` (tooling, login budget, selectors,
fixtures: everything there applies here), `frontend/playwright.config.ts`,
`frontend/e2e/fixtures.ts`, and the page files named in `design.md`. Take every label from those
source files; never guess a text.

## Start gate

Order and gates for all changes of this round: `docs/team-ronda-1.md`.

Do **not** start until the issue of `e2e-critical-flows` is closed **and**
`git cat-file -e origin/main:frontend/e2e/fixtures.ts` succeeds. If the gate is closed, stop: do
not write code for this change.

## Why

The base E2E suite covers login, navigation, the admin hierarchy and *Equipos*. The client's two
daily flows (dashboard; history and export) need the same safety net before the redesign of
those pages (`ui-redesign-2`, `ui-redesign-3`).

## Scope

Allowed: `frontend/e2e/client-dashboard.spec.ts`, `frontend/e2e/history-export.spec.ts` (new).

Exclude: everything else, including `playwright.config.ts`, `fixtures.ts`, `global-setup.ts`
(if a fixture is missing, ask in the issue), app source, backend.

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
make dev && cd frontend
npm run test:e2e          # all green, twice in a row
```
