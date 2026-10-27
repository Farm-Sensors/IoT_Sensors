# Tasks

- [ ] 1. Add `@playwright/test` (devDependency), `playwright.config.ts`, scripts `test:e2e` and
      `test:e2e:ui`, and ignore Playwright output folders.
- [ ] 2. Write `e2e/global-setup.ts` (stack check + one UI login per role → storage states) and
      `e2e/fixtures.ts` (`adminPage`, `clientPage`, `api`).
- [ ] 3. Write the four spec files of `design.md`, one at a time, each green before the next.
- [ ] 4. Add the `test.exclude` line to `vite.config.ts` and check `npm test -- --run` runs no `e2e/` file.
- [ ] 5. README «Desarrollo Local» and `docs/operations.md`: how to install the browser and run
      the suite, that it needs the local stack, and (paso 0 of the manual steps) that
      `backend/.env` needs `LOGIN_RATE_LIMIT_MAX_ATTEMPTS=1000` for repeated E2E runs.
- [ ] 6. PR: paste two consecutive green runs, the list "Sin nombre accesible" (may be empty),
      and confirm no file under `frontend/src/` changed.
