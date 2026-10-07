## ADDED Requirements

### Requirement: Current dashboard telemetry and freshness

The client dashboard SHALL present current nested telemetry (12 v1 fields) with units, distinguish `null` from measured zero, and emphasize soil humidity, irrigation flow, and ETO. Freshness SHALL reuse `FRESH_MINUTES_THRESHOLD` mapped to current/stale without a competing vocabulary, and cover loading, empty, and error. Weather and latest-point NDVI cards are in scope: they SHALL remain separate provenance streams, SHALL render from frozen 200 fixtures in `docs/integration/frontend-evidence/`, and SHALL use existing UI error state (no extra fixtures). This change SHALL NOT modify backend code. C1 is not required to start.

#### Scenario: Priority values are prominent

- **WHEN** latest readings are available for the selected area
- **THEN** soil humidity, flow per minute, and ETO are visually prominent with units

#### Scenario: Null is not shown as zero

- **WHEN** a telemetry field is JSON `null`
- **THEN** the UI does not display it as a measured `0`

#### Scenario: Weather and NDVI stay separate

- **WHEN** the dashboard shows current area data
- **THEN** weather and latest-point NDVI cards render from frozen 200 fixtures, labeled as a separate source, and are not mixed into the 12 telemetry fields
