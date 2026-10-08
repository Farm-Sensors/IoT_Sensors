## ADDED Requirements

### Requirement: Exact nested v1 reading serializer

GET `/api/v1/readings` and GET `/api/v1/readings/latest` SHALL serialize each reading so that `timestamp` is UTC ISO 8601 ending in uppercase `Z`; `soil`, `irrigation`, and `environmental` are objects (never JSON `null`); all 12 v1 fields are present; unavailable values are JSON `null`; measured zero remains `0`; and Spanish ORM names do not appear. Nested objects SHALL match `contracts/edge-cloud/v1/telemetry.schema.json`. Wrapper `id` and `node_id` MAY remain. Tenant auth, pagination, filters, ingestion, and export SHALL NOT regress.

#### Scenario: History returns all 12 nested fields

- **WHEN** a client GETs reading history for an owned area
- **THEN** each item includes the 12 fields under the three categories and a timestamp ending in uppercase `Z`

#### Scenario: Latest uses uppercase UTC Z

- **WHEN** a client GETs the latest reading
- **THEN** the JSON timestamp is valid UTC and ends in uppercase `Z`

#### Scenario: Unavailable values stay null

- **WHEN** a stored field is NULL
- **THEN** the JSON field is `null`, not omitted and not `0`
