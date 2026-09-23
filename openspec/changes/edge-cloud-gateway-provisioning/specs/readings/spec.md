# Delta for Readings

## ADDED Requirements

### Requirement: Gateway-scoped telemetry idempotency

The system MUST require an event identifier for gateway telemetry and SHALL scope idempotency by authenticated gateway, configured logical node, and event identifier. The endpoint is implicit because telemetry has a dedicated persistence domain. Its v2 headers, body schema, errors, and retry semantics are normatively defined by `../../machine-contract.md`. An exact retry MUST return the existing reading without creating another record. Reuse of the same identity with a different request body MUST return a conflict and create no record. NDVI replay semantics are distinct and are not part of this identity.

#### Scenario: Gateway retries an accepted telemetry event

- GIVEN a gateway previously received successful acceptance for a logical-node telemetry event
- WHEN it retries with the same event identifier and identical body
- THEN the system returns the existing reading and creates no duplicate

#### Scenario: Gateway reuses an event identifier with a different body

- GIVEN a gateway event identity already belongs to a stored reading
- WHEN the gateway sends the same identity with a changed telemetry body
- THEN the system returns a conflict and preserves the original reading

#### Scenario: Different logical nodes use the same event identifier

- GIVEN two logical nodes are authorized in one gateway configuration
- WHEN each submits an otherwise valid telemetry event with the same event identifier
- THEN the system treats the events independently because their logical-node identities differ

### Requirement: Capture-time ordering and suspicious timestamps

The system MUST retain accepted telemetry using the edge capture timestamp as canonical history time, even when events arrive late or out of order. The system MUST mark an anomalous timestamp as suspicious without silently rewriting it or discarding an otherwise valid event. Latest-reading and freshness calculations MUST use the greatest accepted capture timestamp for the logical node, not HTTP arrival order.

#### Scenario: Late telemetry arrives after a newer reading

- GIVEN a logical node already has a reading captured at 12:10 UTC
- WHEN an accepted event captured at 12:00 UTC arrives at 12:20 UTC
- THEN the system stores the event at 12:00 UTC and keeps the 12:10 UTC reading as latest

#### Scenario: Suspicious timestamp is retained

- GIVEN a gateway submits a valid telemetry event whose capture timestamp is anomalous according to cloud validation
- WHEN the event is otherwise authorized and valid
- THEN the system stores its original capture timestamp and exposes a suspicious marker

## MODIFIED Requirements

### Requirement: Reading ingestion endpoint

- The system SHALL expose `POST /api/v1/readings` for gateway telemetry ingestion.
- The endpoint SHALL authenticate a property-scoped gateway credential and SHALL resolve the configured logical node and irrigation area from the authenticated gateway's active configuration.
- The request SHALL identify a configured logical node and carry an event identifier; the identity MUST NOT be supplied by an untrusted direct node credential.
- The payload SHALL contain a mandatory `timestamp` (ISO 8601 UTC) and the 3 dynamic categories: `soil` (4 fields), `irrigation` (3 fields), `environmental` (5 fields).
- The endpoint SHALL reject an invalid gateway credential, inactive gateway, unconfigured logical node, or cross-property area identity (401/403) and SHALL create no reading.
- The endpoint SHALL return the created reading id, logical node id, and timestamps (201), or the existing metadata for an exact retry (200).
- The endpoint SHALL be write-only: it must not expose reading queries.

(Previously: The endpoint authenticated a sending node directly with its fixed API key.)

#### Scenario: Gateway sends a valid reading
- **GIVEN** an active gateway is authorized for a configured logical node
- **WHEN** an active gateway POSTs a payload with a valid gateway credential, configured logical-node identity, event identifier, timestamp and the 3 categories
- **THEN** the reading is stored in a single row for that logical node and the API returns 201 with the reading metadata

#### Scenario: Invalid gateway credential
- **GIVEN** no authenticated gateway context exists for the request
- **WHEN** a request POSTs to /api/v1/readings with an unknown, missing, or legacy node-only credential
- **THEN** the API rejects the request with 401/403 and no reading is stored

#### Scenario: Gateway sends an unconfigured logical node
- **GIVEN** an active gateway has an active configuration
- **WHEN** an authenticated gateway posts a reading for a logical-node identity absent from its active configuration
- **THEN** the API rejects the request and does not associate it with an area

### Requirement: Payload semantics

- The system SHALL store unavailable dynamic fields as NULL only when the payload supplies JSON `null`; a numeric `0` SHALL be stored as a measured zero and MUST NOT mean unavailable.
- `irrigation.active` SHALL be a boolean or `null`; `accumulated_liters` and `flow_per_minute` SHALL be separate numeric fields.
- Static data (crop type, area size, GPS), direct-node credentials, and physical-device metadata SHALL NOT be part of the telemetry payload; unknown extra fields are rejected by the versioned contract.
- NDVI SHALL NOT be part of the telemetry payload; it SHALL use its separate latest-point event.

(Previously: Unavailable fields could be represented by either `0` or `null`, and unknown extra fields were ignored.)

#### Scenario: Gateway reports an unavailable sensor value
- **GIVEN** a gateway is authorized for a configured logical node
- **WHEN** a configured logical node lacks a specific sensor value such as ETO
- **THEN** the payload sends that field as `null` and the reading stores NULL

#### Scenario: Gateway reports a measured zero
- **GIVEN** a gateway is authorized for a configured logical node
- **WHEN** a configured logical node measures zero flow per minute
- **THEN** the payload sends `0` and the reading stores numeric zero rather than NULL

#### Scenario: Payload includes an unsupported field
- **GIVEN** a gateway is authorized for a configured logical node
- **WHEN** a telemetry payload includes static data, NDVI, or an unknown field
- **THEN** the API rejects the payload and stores no reading

### Requirement: Ingest cadence

- The system SHALL accept gateway readings at any cadence; the designed target is one reading every 10 minutes per logical node (144 per day).
- Ingestion SHALL NOT depend on the simulator; any authorized gateway that conforms to the published versioned contract can send readings.
- The backend SHALL accept only ISO 8601 UTC capture timestamps with an explicit `Z`; naive timestamps SHALL be rejected.

(Previously: Any HTTP client with a valid node API key could ingest, including naive timestamps stored without UTC normalization.)

#### Scenario: Gateway sends readings on schedule
- **GIVEN** a gateway is authorized for a configured logical node
- **WHEN** a gateway sends valid readings every 10 minutes for a configured logical node
- **THEN** the platform accepts up to 144 readings per day for that logical node without requiring a simulator

#### Scenario: Naive timestamp received
- **GIVEN** a gateway is authorized for a configured logical node
- **WHEN** a gateway sends a timestamp without a UTC marker
- **THEN** the API rejects the event as invalid and stores no reading

### Requirement: Latest and availability

- The system SHALL expose the latest reading per area (`/api/v1/readings/latest`) to power dashboards and the freshness indicator.
- The latest reading SHALL be selected by the greatest accepted capture timestamp for the area's logical node, not request arrival time.
- The system SHALL expose date availability (`/api/v1/readings/availability`) for the date-range picker.

(Previously: Latest behavior did not state how late or out-of-order capture timestamps are ordered.)

#### Scenario: Dashboard loads latest reading
- **GIVEN** an authorized user selected an irrigation area
- **WHEN** the dashboard requests the latest reading for the selected area
- **THEN** the API returns the reading with the greatest accepted capture timestamp or a freshness indicator showing time elapsed

#### Scenario: Late arrival does not replace the latest reading
- **GIVEN** an area already has a newer accepted capture-time reading
- **WHEN** an older capture-time reading arrives after a newer one for the same area
- **THEN** the latest endpoint continues to return the newer capture-time reading

### Requirement: Freshness indicator

- The system SHALL provide the data needed to display logical-node reading freshness: last reading capture timestamp and elapsed time per node/area, computed from the latest capture-time reading.
- Gateway connectivity status SHALL remain a separate concept and SHALL NOT replace logical-node reading freshness.

(Previously: Freshness was defined only from the latest reading without distinguishing gateway status.)

#### Scenario: Logical node stops sending readings
- **GIVEN** an authorized user views a logical node area
- **WHEN** a logical node has not sent a reading for 2 hours
- **THEN** the UI shows “last data: 2 hours 30 min ago” from the latest reading capture timestamp

#### Scenario: Gateway remains connected while a node is stale
- **GIVEN** an authorized user views a gateway and its logical node area
- **WHEN** a gateway has a recent heartbeat but an area has no recent reading
- **THEN** the UI can show a recent gateway status and stale reading freshness independently
