# Design: ui-redesign-2-client-dashboard

Fixed by this brief:

- Priority order and prominence: soil humidity, water flow, ETO (`AGENTS.md` §2.2).
- Freshness (`AGENTS.md` §2.3) is shown **once per área in view** with date, time and elapsed
  time. Today it repeats because the priority cards receive `lastUpdate`
  (`DesktopDashboard.tsx`, `MobileDashboard.tsx` → `MetricCard.tsx`): stop passing it to the
  priority cards and keep one `FreshnessIndicator` for the área. Update `docs/design-system.md`
  §7 rule 2 («Frescura siempre visible») to say «una vez por área, en el encabezado».
- External weather and latest-point NDVI stay visually separate from sensor telemetry and
  labeled as another source (`ExternalDataCards.tsx`); NDVI never looks like a 13th field.
- `null` is shown as «Sin datos» (the text `readings.ts` already produces), never `0`.
- The three categories (Suelo, Riego, Ambiental) stay grouped as categories.
- Desktop and mobile variants (`DesktopDashboard.tsx`, `MobileDashboard.tsx`) both follow the
  same hierarchy.
