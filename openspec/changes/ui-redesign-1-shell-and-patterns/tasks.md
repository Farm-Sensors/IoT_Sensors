# Tasks

- [ ] 1. Before changing code, write in the PR description a table «Hallazgos» with one row per page in Scope: what is confusing or heavy today (too much text, no clear primary action, hidden or repeated status, poor mobile, contrast), taken from using the local app, plus a screenshot.
- [ ] 2. Write «Patrones de pantalla» in `docs/design-system.md` (design.md list) and get it approved
      by Alan in the PR before step 3 (push the doc commit first and wait for the review comment).
- [ ] 3. Update tokens in `theme.css` if needed (document each).
- [ ] 4. Implement the shared components for the patterns.
- [ ] 5. Apply them to the login and `ProfilePage.tsx`.
- [ ] 6. Redesign layouts, sidebar and mobile tab bar.
- [ ] 7. Check both roles at 1366 and 390, light and dark, by keyboard.
- [ ] 8. Keep or update tests per `docs/ui-redesign-rules.md` §5; add tests for new interactive behavior.
- [ ] 9. Update `docs/design-system.md` for every new token or shared component, and the
      screen descriptions in `docs/system.md` (Frontend section) that this change makes wrong.
- [ ] 10. PR evidence per `docs/ui-redesign-rules.md` §6 (screenshots 1366 light/dark and 390,
      command outputs, «Inconsistencias encontradas», «Propuestas fuera de alcance»).
