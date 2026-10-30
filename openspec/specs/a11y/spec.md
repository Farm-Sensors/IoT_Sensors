# a11y Specification

## Purpose
TBD - created by archiving change a11y-automated-checks. Update Purpose after archive.

## Requirements

### Requirement: Accessibility gate per page

The frontend SHALL provide `npm run test:a11y`, which scans the pages in `design.md` with axe
and fails only on serious or critical violations that are not in the committed baseline.

#### Scenario: Baseline on main

- **WHEN** `npm run test:a11y` runs on the `main` that contains this change
- **THEN** it passes, and `a11y-baseline.json` contains every serious/critical violation found

#### Scenario: A PR adds a violation

- **WHEN** a change introduces a new serious violation on a scanned page
- **THEN** the run fails and names the page, rule id, help URL and element

#### Scenario: A PR fixes violations

- **WHEN** a change removes violations listed in the baseline
- **THEN** the run passes and prints which baseline entries can be lowered
