# Change: a11y-automated-checks

## Agent start

Owner: Fabián (`@fabianfugg`). This folder is the brief. Implement `tasks.md`; nothing else.
Reuses the config, fixtures and login of `e2e-critical-flows`.
Read first: `docs/ui-redesign-rules.md` §4, `frontend/playwright.config.ts`, `frontend/e2e/fixtures.ts`.

## Start gate

Order and gates for all changes of this round: `docs/team-ronda-1.md`.

Do **not** start until the issue of `e2e-client-flows` is closed **and** `git cat-file -e origin/main:frontend/e2e/history-export.spec.ts` succeeds. If the gate is
closed, stop: do not write code for this change.

## Why

The redesign must improve accessibility, and each redesign PR must prove it does not make it
worse. An automated scan of every main page gives a measurable baseline and a gate.

## Scope

Allowed: `frontend/e2e/a11y.spec.ts`, `frontend/e2e/a11y-baseline.json`, `frontend/package.json`
and lock (devDependency `@axe-core/playwright`, script `test:a11y`), `docs/ui-redesign-rules.md`
§4 (point to the command), `docs/operations.md`.

Exclude: any app source under `frontend/src/` (this change measures; it does not fix), backend.

## Non-goals

No fixes of the violations found (the redesign changes do that). No Lighthouse, no CI.

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
npm run test:a11y            # green with the committed baseline
npm run test:e2e             # still green
```
