# Design: a11y-automated-checks

- `@axe-core/playwright` with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`. Reuse the storage
  states and `api` fixture of `e2e-critical-flows` (no extra logins).
- Pages scanned in the `desktop` and `mobile` projects, after the page's `h1` is visible. Ids are
  resolved through the `api` fixture from the seed (predio «DEMO - Rancho Norte», its first área
  and node, the gateway of predio 1 created by `make dev`):
  - login `/` (logged out);
  - client: `/cliente` (predio «DEMO - Rancho Norte», área «DEMO - Nogal Norte»),
    `/cliente/areas`, `/cliente/predio/:predioId`, `/cliente/mapa`, `/cliente/historico`,
    `/cliente/exportar`, `/cliente/perfil`;
  - admin: `/admin`, `/admin/clientes`, `/admin/clientes/:clientId/predios`,
    `/admin/clientes/:clientId/dashboard`, `/admin/predios/:predioId/areas`, `/admin/cultivos`,
    `/admin/ciclos`, `/admin/nodos`, `/admin/nodos/:nodeId`, `/admin/gateways`,
    `/admin/gateways/:gatewayId`, `/admin/gateways/pair`, `/admin/mapa`.
- Open states, desktop only (the create forms are not ARIA dialogs; wait for the form heading the
  page renders after the click): `/admin/clientes` → «Nuevo Cliente»; `/admin/predios/:predioId/areas`
  → «Nueva Área de Riego»; `/admin/cultivos` → «Nuevo Cultivo» (heading «Nuevo Tipo de Cultivo»);
  `/admin/ciclos` → «Nuevo Ciclo» (heading «Nuevo Ciclo de Cultivo»); `/admin/nodos` → «Nuevo
  Nodo» (heading «Nuevo Nodo IoT»); `/admin/gateways/:gatewayId` of predio 1 → «Revocar enlace», scan the confirmation, then
  press «Cancelar» so nothing is revoked.
- Gate: only `serious` and `critical` violations count. The unit is **page + project + rule id**
  with a node count. `a11y-baseline.json` stores those counts as found on `main` when this change
  is written. A run fails when a unit is new or its count is higher than the baseline; it prints,
  for each, the rule id, help URL and the target selectors (informational).
- A unit with a lower count passes and prints "Baseline puede bajar: <page> <project> <rule>", so
  the redesign PR that fixed it lowers the baseline in the same PR.
- `npm run test:a11y` runs only `a11y.spec.ts`; `npm run test:e2e` keeps running all specs.
