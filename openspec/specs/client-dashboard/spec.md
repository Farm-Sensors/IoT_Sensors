# client-dashboard Specification

## Purpose
TBD - created by archiving change ui-redesign-2-client-dashboard. Update Purpose after archive.

## Requirements

### Requirement: Glanceable dashboard

The client dashboard SHALL show, without scrolling at 1366×900, the selected predio and área,
one freshness indicator for the área, and the three priority values with units.

#### Scenario: Current data

- **WHEN** the client opens `/cliente` with the demo data and a running simulator
- **THEN** predio, área, one freshness indicator and humidity, flow and ETO with units are
  visible in the first viewport, and the other categories follow below

#### Scenario: Stale data

- **WHEN** the área's last reading is older than `FRESH_MINUTES_THRESHOLD`
- **THEN** the stale state is shown once for the área with date, time and elapsed time, with an
  icon or text besides color

#### Scenario: Missing value

- **WHEN** a telemetry field is `null`
- **THEN** it is shown as missing, never as `0`
