# e2e-client Specification

## Purpose
TBD - created by archiving change e2e-client-flows. Update Purpose after archive.

## Requirements

### Requirement: Client flows covered end to end

The E2E suite SHALL cover the client dashboard and the history/export flows in `design.md` for
desktop and mobile, using the existing fixtures and without changing application source.

#### Scenario: Green twice

- **WHEN** the local stack is up and `npm run test:e2e` runs twice in a row
- **THEN** both client spec files pass both times

#### Scenario: Missing value stays missing

- **WHEN** the dashboard renders a field that is `null`
- **THEN** the test does not accept `0` in its place (assert the «Sin datos» text if a `null`
  field is present in the demo data; otherwise skip this check and say so in the PR)
