# Design: ui-redesign-4-admin-pages

Fixed by this brief:

- Each CRUD page: page header with one primary action ("Nuevo …" as named today), the list
  pattern, the form pattern, destructive actions behind the confirmation pattern. Field names,
  required fields and validation stay as they are.
- Hierarchy navigation stays: client → its predios (`/admin/clientes/:clientId/predios`) →
  predio's áreas (`/admin/predios/:predioId/areas`). Make the current place in that hierarchy
  visible on each of those pages (for example a breadcrumb), using names, not IDs.
- Internal IDs, API keys, versions and timestamps that are only useful for support go behind the
  disclosure pattern ("Datos para soporte"), as on `GatewayDetail.tsx`.
- Known bug to fix here: `NodeDetail.tsx` passes `latestReading?.… ?? 0` to `MetricCard`, which
  shows a missing value as `0`. Pass the value so a `null` renders as «Sin datos» (as the client
  dashboard does); add a test.
- Delete confirmations name the entity («¿Eliminar el predio <nombre>?»). Keep any consequence
  text the page already shows; where there is none, use only «Esta acción no se puede deshacer.»
  Do not describe cascades that the page does not already describe.
- *Equipos* pages keep the 2026-10-26 flow: list with `EquipoStateBadge`, wizard of 3 steps with
  one open, «Revocar enlace» on the detail. Only visual alignment with the patterns.
