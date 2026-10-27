## ADDED Requirements

### Requirement: Documented screen patterns

`docs/design-system.md` SHALL contain a «Patrones de pantalla» section covering every pattern in
`design.md`, each mapped to a shared component in `frontend/src/app/components/`.

#### Scenario: Later changes can follow it

- **WHEN** a contributor redesigns a page in changes 2–4
- **THEN** every block of that page maps to one documented pattern and shared component

### Requirement: Shell keeps behavior

Login, layouts and navigation SHALL keep the same routes, entries per role, module gating and
login behavior while meeting `docs/ui-redesign-rules.md` §4.

#### Scenario: Navigation per role

- **WHEN** the admin or the client logs in on desktop or at 390 px
- **THEN** they see exactly the same navigation entries as before this change, the current one is
  marked with more than color, and each is reachable by keyboard

#### Scenario: Login error

- **WHEN** the password is wrong
- **THEN** the error is visible, announced to assistive technology, and focus goes to the field
