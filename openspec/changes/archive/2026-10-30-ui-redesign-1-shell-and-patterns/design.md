# Design: ui-redesign-1-shell-and-patterns

Fixed by this brief (everything else is the owner's visual choice):

- A section **«Patrones de pantalla»** is added to `docs/design-system.md` and is the contract for
  changes 2–4. It MUST define, with a short description and the component that implements it:
  page header (one `h1`, optional one-line subtitle, at most one primary action on the right),
  list of entities as cards or table and when to use each, status badge (icon + text + color),
  disclosure for secondary/support data, form in a dialog vs on the page, empty / loading /
  error states, confirmation of destructive actions, stepper for multi-step flows (as in
  *Equipos*), and the mobile variants of each.
- The shared components implement those patterns; pages in later changes use them instead of
  ad-hoc markup.
- Login: same fields and behavior (`LoginPage.tsx`), errors announced to screen readers, focus on
  the first invalid field.
- Navigation: same entries per role; the current page is obvious (not only by color); the mobile
  tab bar keeps every entry reachable at 390 px without horizontal scrolling of the page.
- Dark and light themes both pass AA contrast for the shell.
