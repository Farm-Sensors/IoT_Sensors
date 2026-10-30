# admin-pages Specification

## Purpose
TBD - created by archiving change ui-redesign-4-admin-pages. Update Purpose after archive.

## Requirements

### Requirement: Focused admin pages

Every admin page in Scope SHALL have one `h1`, at most one primary action in view, the list and
form patterns, and support-only data behind a disclosure, without changing fields, validation,
routes or the hierarchy.

#### Scenario: Building a rancho

- **WHEN** the admin creates a client, then a predio for it, then an área for that predio
- **THEN** each page shows where they are in the hierarchy by name and the next action is the
  primary button

#### Scenario: Destructive action

- **WHEN** the admin deletes an entity
- **THEN** a confirmation names the entity before anything is deleted, with the consequence text
  defined in `design.md`

#### Scenario: Missing node value

- **WHEN** a node's latest reading has a `null` field on `/admin/nodos/:nodeId`
- **THEN** it is shown as «Sin datos», never as `0`

#### Scenario: Equipos unchanged in behavior

- **WHEN** the admin uses *Equipos* after this change
- **THEN** the list states, the 3-step wizard and «Revocar enlace» behave exactly as before
