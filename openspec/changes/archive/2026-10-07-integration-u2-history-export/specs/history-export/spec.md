## ADDED Requirements

### Requirement: History filters and export UI

The history UI SHALL convert quick and custom ranges into exact `start_date`/`end_date` query params, preserve approved cycle filtering, pagination, and irrigation-area scope, and present nested readings with units and `null` semantics. Export actions SHALL call existing `GET /api/v1/readings/export` for CSV, XLSX, and PDF and SHALL NOT generate files in the backend. Loading, empty, error, and page/range-change states SHALL be covered.

#### Scenario: Presets become date params

- **WHEN** a user picks a week, month, year, or custom range
- **THEN** the history request sends exact `start_date` and `end_date`

#### Scenario: Export uses the frozen endpoint

- **WHEN** a user downloads CSV, XLSX, or PDF for the current filters
- **THEN** the UI calls `GET /api/v1/readings/export` with those filters and does not generate the file in frontend-owned backend code

#### Scenario: Empty and error states

- **WHEN** the list is empty or the request fails
- **THEN** the UI shows an empty or error state instead of fabricated rows
