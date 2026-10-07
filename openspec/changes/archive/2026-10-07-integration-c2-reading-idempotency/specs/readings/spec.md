## ADDED Requirements

### Requirement: Telemetry ingestion idempotency

`POST /api/v1/readings` SHALL be idempotent on authenticated node, this endpoint, and a persistent `X-Event-ID`. The first valid event SHALL return `201` and create one canonical row bound to that ID. An exact retry (same node, endpoint, ID, and body) SHALL return `200` and create no additional row. Reusing that ID with a different body SHALL return `409` and mutate nothing. Missing or invalid `X-API-Key` or `X-Event-ID` SHALL fail without mutation. This requirement SHALL NOT apply to NDVI; NDVI has no event-ID.

#### Scenario: Exact retry keeps one row

- **WHEN** the same node retries `POST /api/v1/readings` with the same `X-Event-ID` and body
- **THEN** the API returns `200` and the database still has one reading for that ID

#### Scenario: Same ID different body conflicts

- **WHEN** that ID is reused with a different body
- **THEN** the API returns `409` and no reading is created or updated

#### Scenario: Invalid key or event ID does not write

- **WHEN** `X-API-Key` or `X-Event-ID` is missing or invalid
- **THEN** no reading row is stored
