# UI redesign rules (IoT_Sensors web)

Binding rules for every `openspec/changes/ui-redesign-*` change. The goal is a clearer, more
accessible and more intuitive web app. **Visual freedom is real**: layout, grouping, hierarchy,
components, spacing, color within tokens and microcopy may change. Behavior, data and names may
not. When a rule here and a change folder disagree, the change folder's `proposal.md` wins for
its own scope; anything else not written down is out of scope.

## 1. What MAY change

- Layout, order and grouping of information on a page; collapsing secondary content behind
  disclosures; splitting a long page into tabs or steps.
- Presentational components (cards, tables, empty states, badges, headers). New presentational
  components go in `frontend/src/app/components/` with a colocated test when they have behavior.
- Visual tokens: reuse the CSS variables in `docs/design-system.md`. A new token is allowed only
  if it is added to `docs/design-system.md` (light and dark value, purpose) in the same PR.
- Microcopy (titles, helper lines, button labels) when it becomes shorter or clearer, keeping the
  vocabulary in section 3.
- Responsive behavior and the mobile tab bar layout.

## 2. What MUST NOT change

- **API and data:** no edits to `frontend/src/app/services/`, `frontend/src/app/types/`,
  `frontend/src/app/utils/` (date presets, filters, chart grouping, export), any backend file.
  Pages that call the API inline (for example `ExportData.tsx`, `ReadingDateRangeSelector.tsx`)
  keep every `api.*` call, URL and parameter byte-identical. No new endpoints, no change to
  polling intervals or response handling.
- **Business rules:** freshness threshold (`FRESH_MINUTES_THRESHOLD`), `null` versus measured `0`
  (a `null` value is never shown as `0`), units (fixed table in `AGENTS.md` §2.4), the 12
  telemetry fields and their categories (Suelo, Riego, Ambiental), date-preset resolution, export
  formats (CSV, Excel, PDF), role permissions (admin vs client), and which data each role sees.
- **Routes** in `frontend/src/app/routes.tsx` (paths and which page each one renders).
- **Phase 2 stays as it is.** Gated modules (alerts, thresholds, notifications, AI) keep their
  `module` gating in `components/navigation/items.ts` and `GET /api/v1/settings/modules`. Some
  Phase 2 entry points are **not** gated and stay exactly as they are too: the «Auditoría» nav
  entry, the «Configurar Umbrales» and «Ver Auditoría» links on `AdminDashboard.tsx`, and the
  «¿Olvidé mi contraseña?» link on the login. Phase 2 pages (alerts, thresholds, notifications,
  AI, audit, password reset) are out of scope; they may only change as a side effect of a shared
  component they render.
- **Names:** do not rename entities. Keep the terms already used on each screen ("Predio(s)",
  "Área de riego", "Nodo", "Equipo", "Cliente", "Ciclo de cultivo", "Catálogo"). If you find an
  inconsistency (for example "Predio" in the client UI and "rancho" on *Equipos*), list it under
  "Inconsistencias encontradas" in the PR description; do not fix it.
- **Prominence of priority data** (`AGENTS.md` §2.2): soil humidity, water flow and ETO stay the
  most prominent values on the dashboard. The freshness indicator (last reading date and time
  plus elapsed time, `AGENTS.md` §2.3) stays visible for every area/node shown.
- **Dependencies:** no new UI framework or component library. Existing: Tailwind v4, the Radix
  based components in `frontend/src/app/components/ui/`, `lucide-react`, `recharts`, `motion`. A
  new small dependency needs a one-line justification in the PR.

## 2b. Shared component ownership

Each shared component is edited by exactly one redesign change (others see the result as a side
effect and must not edit it):

| Component(s) in `frontend/src/app/components/` | Owner change |
|---|---|
| `ui/` (Radix-based primitives), `PillButton`, `BentoCard`, `EmptyState`, `ConfirmDialog`, `Toast`, `SkeletonCard`, `MetricSkeleton`, `AnimatedBackground`, `PageTransition`, `icons/`, `auth/`, `navigation/` | `ui-redesign-1-shell-and-patterns` |
| `MetricCard`, `FreshnessIndicator` (look only; its freshness math is logic), `GatewayStatusBadge`, `selection/SelectionScopeBar` | `ui-redesign-2-client-dashboard` |
| `ReadingDateRangeSelector`, `ChartSkeleton` | `ui-redesign-3-history-export-map` |
| `PairingApprovalPanel`, `EquipoStateBadge`, `RevokeLinkButton` | `ui-redesign-4-admin-pages` |

Not edited by any redesign change: `ProtectedRoute.tsx`, `ErrorBoundary.tsx` (logic),
`notifications/` (Phase 2), `figma/`, `maps/` data hooks.

## 3. Vocabulary (user-facing text, Spanish, Mexico)

- Raspberry = **equipo**. Zone = **área de riego** / **área**. Never "gateway", "ranura",
  "parcela", "pairing", "slot", "payload" in visible text.
- Plain words, short sentences, no internal IDs or versions in primary text (they may live in a
  closed "Datos para soporte" disclosure, as on `GatewayDetail`).

## 4. Accessibility (acceptance, not optional)

- WCAG 2.1 AA contrast for text and essential icons, in light and dark themes.
- Every interactive element reachable and operable by keyboard, with a visible focus ring; focus
  moves to the new content after a step change or dialog open, and returns on close.
- One `h1` per page and a logical heading order; form fields have visible labels.
- Status is never conveyed by color alone (icon or text with it).
- Touch targets at least 44×44 px at the 390 px width.
- Run `cd frontend && npm run test:a11y`. A PR MUST NOT add new serious or critical violations
  or increase their node counts versus `e2e/a11y-baseline.json` for the pages it touches.

## 5. Tests

- `cd frontend && npm test -- --run`, `npm run typecheck` and `npm run build` pass.
- Behavior tests are not deleted. A test that asserts visible text may be updated when the text
  changes on purpose. New interactive behavior (a disclosure, tabs, a stepper) gets a test.
- When `frontend/e2e/` exists on `main`, `npm run test:e2e` passes against the local stack; if a
  label the E2E suite uses changes on purpose, update the E2E selector in the same PR.

## 6. How to work

- Run the app locally with the README «Desarrollo Local» steps (or `make dev` once it exists) and
  the demo data (`make demo-seed`, `scripts/dev_gateway.py`, the simulator). Log in as
  `admin@sensores.com` / `admin123` and as `alan2203mx@gmail.com` / `123`. There is no access to
  the lab server or the Raspberry, and none is needed.
- If a change you want needs an API, data or rule change: **stop, do not implement it**, and add
  it to the PR under "Propuestas fuera de alcance".
- PR evidence: before/after screenshots of every page touched, at 1366 px (light and dark) and
  390 px (light); the test command outputs; the two PR lists above (may be empty).
- Branch `feat/<issue-number>-<short-name>` from `main`; PR to `main` with `Closes #<issue>`. Alan
  reviews, merges and deploys; never push to `main`.
