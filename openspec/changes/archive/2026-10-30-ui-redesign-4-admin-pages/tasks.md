# Tasks

- [ ] 1. Before changing code, write in the PR description a table «Hallazgos» with one row per page in Scope: what is confusing or heavy today (too much text, no clear primary action, hidden or repeated status, poor mobile, contrast), taken from using the local app, plus a screenshot.
- [ ] 2. Redesign `ClientManagement.tsx`, `PropertyManagement.tsx`, `IrrigationAreaManagement.tsx`
      with the hierarchy indicator (one commit per page).
- [ ] 3. Redesign `CropTypeManagement.tsx`, `CropCycleManagement.tsx`.
- [ ] 4. Redesign `NodeManagement.tsx`, `NodeDetail.tsx` (support data behind the disclosure).
- [ ] 5. Redesign `AdminDashboard.tsx`, `DashboardPreferences.tsx`, `AdminMapPage.tsx`.
- [ ] 6. Align the *Equipos* pages with the patterns, behavior untouched.
- [ ] 7. Lower `a11y-baseline.json` entries fixed by this change, if the gate exists.
- [ ] 8. Keep or update tests per `docs/ui-redesign-rules.md` §5; add tests for new interactive behavior.
- [ ] 9. Update `docs/design-system.md` for every new token or shared component, and the
      screen descriptions in `docs/system.md` (Frontend section) that this change makes wrong.
- [ ] 10. PR evidence per `docs/ui-redesign-rules.md` §6 (screenshots 1366 light/dark and 390,
      command outputs, «Inconsistencias encontradas», «Propuestas fuera de alcance»).
