# Tasks

- [ ] 1. Before changing code, write in the PR description a table «Hallazgos» with one row per page in Scope: what is confusing or heavy today (too much text, no clear primary action, hidden or repeated status, poor mobile, contrast), taken from using the local app, plus a screenshot.
- [ ] 2. Redesign the filter area (`ReadingDateRangeSelector.tsx`) with the patterns.
- [ ] 3. Redesign `HistoricalData.tsx` results (chart/table) and its empty/loading/error states.
- [ ] 4. Redesign `ExportData.tsx` (filter summary + three actions).
- [ ] 5. Redesign `ClientMapPage.tsx` presentation (legend, controls, mobile).
- [ ] 6. Check that the URLs and query parameters produced by the filters are unchanged
      (compare the network requests before and after in the browser dev tools; paste both).
- [ ] 7. Lower `a11y-baseline.json` entries fixed by this change, if the gate exists.
- [ ] 8. Keep or update tests per `docs/ui-redesign-rules.md` §5; add tests for new interactive behavior.
- [ ] 9. Update `docs/design-system.md` for every new token or shared component, and the
      screen descriptions in `docs/system.md` (Frontend section) that this change makes wrong.
- [ ] 10. PR evidence per `docs/ui-redesign-rules.md` §6 (screenshots 1366 light/dark and 390,
      command outputs, «Inconsistencias encontradas», «Propuestas fuera de alcance»).
