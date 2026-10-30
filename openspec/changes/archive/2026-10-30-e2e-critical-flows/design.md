# Design: e2e-critical-flows

## Tooling (closed decisions)

- `@playwright/test`, Chromium only, `baseURL` `http://localhost:5173`, `workers: 1`,
  `retries: 0`, trace `retain-on-failure`, two projects: `desktop` (1366×900) and `mobile`
  (390×844, `isMobile: true`). Every spec runs in both projects unless its row says
  "desktop only".
- **Login budget.** The backend allows 10 logins per 15 min per email and per IP unless the local
  `backend/.env` sets `LOGIN_RATE_LIMIT_MAX_ATTEMPTS=1000` (written by `make dev`; with the manual
  README steps add it by hand). Regardless, the suite logs in through the UI **once per role** in
  `globalSetup` and saves Playwright `storageState` files (`e2e/.auth/admin.json`,
  `e2e/.auth/client.json`, git-ignored); specs use those states. Only `auth.spec.ts` uses the
  login form again. The `api` helper logs in once per run and caches the admin token.
- `frontend/e2e/fixtures.ts`: test fixtures `adminPage` / `clientPage` (from the storage states)
  and `api` (Playwright `request` against `http://localhost:5050/api/v1`) for setup and cleanup
  only, never to assert UI behavior.
- Selectors: `getByRole`, `getByLabel`, `getByText` with names copied from the source files. No
  CSS classes, no XPath, no `nth-child`. If an element has no accessible name (for example the
  predio/área selects on the client dashboard), locate it through the closest element with one
  and list it in the PR under "Sin nombre accesible"; do not edit the app.
- Data created by a test uses the prefix `E2E ` plus a timestamp. Cleanup in `afterEach`, in this
  order: revoke any gateway the test created (`POST /gateways/{id}/revoke`; there is no delete),
  then delete área, predio, client. The seeded data is never modified or deleted.
- `globalSetup` first checks `GET http://localhost:5050/health` and `GET http://localhost:5173/`
  and fails with "Levanta el stack local con make dev" if either is down. The suite never starts
  or stops the stack.

## Flows (one spec file each)

The client flows (`client-dashboard.spec.ts`, `history-export.spec.ts`) belong to
`e2e-client-flows` and are not written here.

| File | Role | Flow and assertions |
|---|---|---|
| `auth.spec.ts` | both, desktop only | Login form at `/` (`pages/auth/LoginPage.tsx`): a wrong password shows the error and stays on `/`; admin login lands on `/admin`; client login lands on `/cliente`; logout returns to the login. These are the only form logins besides `globalSetup`. |
| `navigation.spec.ts` | both | Every entry of `components/navigation/items.ts` for the role without a `module` field opens its route and shows that page's `h1` (read it from the page file; `/admin/auditoria` shows «Bitácora de Auditoría»). Entries with `module` are absent (Phase 2 flags are off locally). On `mobile` use the tab bar (`MobileTabBar.tsx`), whose names are `mobileLabel ?? label`. |
| `admin-hierarchy.spec.ts` | admin, desktop only | `ClientManagement.tsx`: «Nuevo Cliente», fill the form fields it renders, save → the client is in the list. From that client go to its predios (`/admin/clientes/:clientId/predios`, `PropertyManagement.tsx`): «Nuevo Predio» → saved → listed. From the predio go to its áreas (`/admin/predios/:predioId/areas`, `IrrigationAreaManagement.tsx`): «Nueva Área de Riego» with a crop type of the catalog → listed. |
| `equipos.spec.ts` | admin, desktop only | Setup via API: client + predio + one área (prefix `E2E `). On `/admin/gateways` (`GatewayManagement.tsx`): «Nuevo equipo» → step 1 select «Rancho» with the option `"<predio> · <empresa>"`, check the área → «Crear y continuar» → step 2 («Vincular equipo») is the open step. Open «¿El equipo no muestra código?», generate the reference, assert its `ar_…` value and the image with alt «QR de la referencia» are shown. Read that value from the page and act as the device: `POST /api/v1/gateways/activate` `{"activation_reference": <value>}`. Reload `/admin/gateways?gateway=<id>`: the open step is «Asignar nodos». Back on the list, that card's badge is «Asignando nodos». Go to `/admin/gateways/<id>` (`GatewayDetail.tsx`) by URL, «Revocar enlace» → confirm → the state reads «Revocado». |

Exact button names, headings and field labels come from the page files above.
