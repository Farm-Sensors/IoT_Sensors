# e2e Specification

## Purpose
TBD - created by archiving change e2e-critical-flows. Update Purpose after archive.

## Requirements

### Requirement: Critical flows run end to end

The frontend SHALL have a Playwright suite under `frontend/e2e/`, run with `npm run test:e2e`
against the local stack, covering the four flows in `design.md` (the client flows are added by `e2e-client-flows`) for the desktop and mobile
projects as stated.

#### Scenario: Green on an unchanged main

- **WHEN** the local stack is up and `npm run test:e2e` runs twice in a row on `main`
- **THEN** every test passes both times and the seeded data is unchanged

#### Scenario: Stack down

- **WHEN** the backend or the frontend is not running
- **THEN** the suite stops in global setup with the message "Levanta el stack local con make dev"

### Requirement: Tests read like the user

Tests SHALL locate elements by role, label or visible text taken from the source, and SHALL NOT
change application source files.

#### Scenario: A label changes on purpose

- **WHEN** a redesign PR renames a button the suite uses
- **THEN** only the selector in `frontend/e2e/` changes in that PR, and the flow still passes
