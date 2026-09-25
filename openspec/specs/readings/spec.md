# Readings

> Gateway v2 cutover is specified in `openspec/changes/edge-cloud-gateway-provisioning`. After runtime cutover, `POST /api/v1/readings` authenticates a property gateway credential and a configured logical node; unavailable values are JSON `null`.

## Purpose

Defines the full lifecycle of sensor reading data: ingestion from IoT nodes (write-only endpoint authenticated with a fixed per-node API key, unified JSON payload with the 3 dynamic categories) and the read-side API consumed by the frontend (history with filters, latest, availability, priority-status semaphores, freshness, and export).

## Requirements

### Requirement: Reading ingestion endpoint

- The system SHALL expose `POST /api/v1/readings` for sensor payload ingestion.
- The endpoint SHALL authenticate the node via the `X-API-Key` header, validated against the `nodos` table.
- The payload SHALL contain a mandatory `timestamp` (ISO 8601 UTC) and the 3 dynamic categories: `soil` (4 fields), `irrigation` (3 fields), `environmental` (5 fields).
- The endpoint SHALL reject payloads with an invalid or unknown API key (401/403).
- The endpoint SHALL return the created reading id, node id, and timestamps (201).
- The endpoint SHALL be write-only: it must not expose reading queries.

#### Scenario: Node sends a valid reading
- **WHEN** a node POSTs a payload with a valid `X-API-Key`, timestamp and the 3 categories
- **THEN** the reading is stored in a single row and the API returns 201 with the reading metadata

#### Scenario: Invalid API key
- **WHEN** a request POSTs to /api/v1/readings with an unknown or missing API key
- **THEN** the API rejects the request with 401/403 and no reading is stored

### Requirement: Payload semantics

- The system SHALL store unavailable dynamic fields as-is: `null` values are stored as NULL and `0` values are stored as `0` (no normalization).
- `irrigation.active` SHALL be a boolean; `accumulated_liters` and `flow_per_minute` SHALL be separate numeric fields.
- Static data (crop type, area size, GPS) SHALL NOT be part of the payload; unknown extra fields are ignored.
- NDVI SHALL NOT be part of the payload (excluded from MVP).

#### Scenario: Node without a sensor category value
- **WHEN** a node lacks a specific sensor (e.g., no ETO sensor)
- **THEN** the payload sends that field as `0` or `null` and the reading is stored correctly (null → NULL, 0 → 0)

### Requirement: Ingest cadence

- The system SHALL accept readings at any cadence; the designed target is 1 reading every 10 minutes per node (144 per day).
- Ingestion SHALL NOT depend on the simulator; any HTTP client with a valid node API key can send readings.
- The backend SHALL accept ISO 8601 timestamps; values without a `Z`/offset (naive) are stored as provided without UTC normalization, and duplicate timestamps for the same node are not deduplicated.

#### Scenario: Simulator sends readings on schedule
- **WHEN** the hardware simulator POSTs every 10 minutes with a valid node key
- **THEN** the platform stores 144 readings per day per node without errors

#### Scenario: Naive timestamp received
- **WHEN** a node sends a timestamp without timezone marker
- **THEN** the reading is stored with the timestamp as provided (no UTC conversion)

### Requirement: History endpoint

- The system SHALL expose `GET /api/v1/readings` for historical readings.
- The endpoint SHALL support filters: `start_date`, `end_date`, `irrigation_area_id`, and `crop_cycle_id`.
- Listing endpoints SHALL paginate with `?page=1&per_page=50` (per_page capped, default 50).
- Responses SHALL return the reading with nested categories (`soil`, `irrigation`, `environmental`) and English field names.
- Date presets (week/month/year) SHALL be resolved on the frontend into `start_date`/`end_date`.

#### Scenario: Query readings by date range
- **WHEN** a user queries readings with start_date and end_date for their area
- **THEN** the API returns paginated readings within that range, scoped to the user's ownership

### Requirement: Latest and availability

- The system SHALL expose the latest reading per area (`/api/v1/readings/latest`) to power dashboards and the freshness indicator.
- The system SHALL expose date availability (`/api/v1/readings/availability`) for the date-range picker.

#### Scenario: Dashboard loads latest reading
- **WHEN** the dashboard requests the latest reading for the selected area
- **THEN** the API returns the most recent reading or a freshness indicator showing time elapsed

### Requirement: Priority status

- The system SHALL expose `GET /api/v1/readings/priority-status` returning semaphore levels (optimal/warning/critical) for the 3 priority parameters: `soil.humidity`, `irrigation.flow_per_minute`, `environmental.eto`, derived from the latest reading and active thresholds.

#### Scenario: Priority parameter breaches threshold
- **WHEN** the latest soil humidity is below the active threshold for the selected area
- **THEN** priority-status reports `critical` for soil.humidity with the breached flag set

### Requirement: Export

- The system SHALL expose `GET /api/v1/readings/export?format=csv|xlsx|pdf` with the same filters as the history endpoint.
- Export generation SHALL happen on the backend and return a downloadable file.
- Unsupported formats SHALL be rejected (whitelist).

#### Scenario: Export readings as CSV
- **WHEN** a user requests export with format=csv and date filters for their area
- **THEN** the backend streams a CSV file with the filtered readings

### Requirement: Freshness indicator

- The system SHALL provide the data needed to display freshness: last reading timestamp and elapsed time per node/area (computed on the frontend from the latest reading).

#### Scenario: Node stops sending readings
- **WHEN** a node has not sent a reading for 2 hours
- **THEN** the UI shows "last data: 2 hours 30 min ago" from the latest reading timestamp