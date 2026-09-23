# Delta for Data Model

## ADDED Requirements

### Requirement: Gateway control-plane records

The database MUST use MySQL 8 records for property gateways, activation references, global gateway templates and their versions, versioned property configurations, prepared logical slots, hardware profiles, physical binding history, and gateway heartbeats. It MUST enforce at most one gateway per property and monotonically unique configuration versions per property using portable relational constraints. Activation records MUST store protected token material and audit-safe lifecycle metadata only. The change MUST NOT require PostgreSQL, TimescaleDB, PostgreSQL-only JSONB, partial indexes, or table partitioning.

#### Scenario: Gateway control-plane records are created

- GIVEN an administrator provisions a gateway for a property
- WHEN the provisioning transaction succeeds
- THEN the database persists the gateway, prepared slots, and associated configuration records under that property

#### Scenario: Duplicate property gateway is persisted

- GIVEN a property already has a gateway record
- WHEN another gateway record is created for the same property
- THEN the database rejects the duplicate relationship

#### Scenario: Duplicate configuration version is persisted

- GIVEN a property has configuration version 3
- WHEN a second configuration record is created with version 3 for that property
- THEN the database rejects the duplicate version

### Requirement: Binding and heartbeat history

The database MUST retain historical physical UID/serial bindings independently from logical node and area identity. Each candidate record MUST retain its gateway, explicitly selected prepared slot/area identity, submission state, and confirmation provenance sufficient to prove that only the same gateway confirmed its own submitted candidate. At most one current confirmed physical binding MAY be active for a logical slot, and reassignment MUST close rather than rewrite the prior binding. Heartbeat records MUST preserve the gateway's most recent accepted connectivity evidence separately from readings. Update authorization and technician-confirmation records MUST retain only gateway-scoped authorization/image identities and timestamps; they MUST NOT retain a user JWT or OTA payload.

#### Scenario: Binding is reassigned

- GIVEN a logical slot has an active confirmed physical binding
- WHEN the owning gateway records local technician confirmation for its previously submitted pending candidate for that slot
- THEN the previous binding remains historical and the new binding becomes current

#### Scenario: Gateway heartbeat is stored

- GIVEN an active gateway sends an accepted heartbeat
- WHEN the heartbeat is persisted
- THEN it is linked to the gateway and not represented as a sensor reading

### Requirement: Global template copy isolation

The database MUST retain global admin gateway templates as versioned entities containing expected-area selectors, pending logical-node slot definitions, and hardware-profile links. Copying a template to a property MUST resolve only that property's existing areas and logical nodes into an independent property working set; later template changes MUST NOT mutate copied slots, bindings, or published property configuration.

#### Scenario: Template copy is isolated from later template edits

- GIVEN an administrator copies version 2 of a global template to a property with matching existing areas
- WHEN the administrator later publishes version 3 of that global template
- THEN the property's copied working set remains unchanged until an administrator explicitly applies another copy/update operation

### Requirement: Separate latest-point NDVI storage

The database MUST store latest-point NDVI separately from `lecturas` and MUST retain its irrigation-area identity, value, provider, Sentinel-2 collection and scene provenance, scene observation time, cloud cover, and point-sample method. It MUST NOT model NDVI history or polygon samples in this change.

#### Scenario: NDVI snapshot is stored separately

- GIVEN an authorized gateway submits a valid NDVI snapshot
- WHEN the database persists it
- THEN the snapshot is associated with its irrigation area and no NDVI column is written to `lecturas`

#### Scenario: Polygon NDVI persistence is requested

- GIVEN a request describes a polygon NDVI sample
- WHEN persistence is attempted
- THEN the system rejects it without creating NDVI history storage

## MODIFIED Requirements

### Requirement: Entity hierarchy

- The system SHALL organize data under the hierarchy Client → Property (`predios`) → Irrigation Area (`areas_riego`).
- A Client SHALL own one or more Properties; a Property SHALL contain one or more Irrigation Areas.
- An Irrigation Area SHALL have exactly one Crop Type (from the admin-manageable catalog) and exactly one logical IoT Node (1:1 relationship, enforced by a unique constraint on `nodos.area_riego_id`).
- A Property SHALL have at most one gateway; the gateway MAY represent many prepared logical nodes for that property's existing irrigation areas.
- A Client SHALL NOT access data of other clients (ownership enforced in the service layer by client-scoped queries).

(Previously: The 1:1 IoT node was also a direct per-node credential holder, with no property gateway.)

#### Scenario: Admin creates a logical node for an area
- **GIVEN** an irrigation area has no logical IoT node
- **WHEN** an admin registers a logical IoT node for an irrigation area
- **THEN** the node is linked 1:1 to that area and is eligible for a property gateway prepared slot

#### Scenario: Gateway represents multiple area nodes
- **GIVEN** a property has multiple irrigation areas with logical nodes
- **WHEN** an administrator provisions a gateway for a property with multiple existing areas
- **THEN** the gateway can be configured with one logical node slot per area without violating area-to-logical-node 1:1

### Requirement: Sensor readings (wide table)

- The system SHALL store each reading as a single row in the `lecturas` table with all 12 dynamic fields flattened (soil, irrigation, environmental categories).
- Each reading SHALL store a mandatory canonical edge capture time (`marca_tiempo`, UTC), a suspicious-timestamp marker when applicable, and its gateway/logical-node event identity.
- Readings SHALL NOT include static data (crop type, area size, GPS), physical-device binding fields, or NDVI — those remain in their respective node/area, binding-history, and NDVI storage models.
- The table SHALL be indexed for logical-node capture-time queries and SHALL enforce gateway + logical node + event identifier uniqueness for new gateway events; the endpoint is implicit in the dedicated telemetry persistence domain.

(Previously: Readings were indexed and idempotent only by direct node identity, without suspicious-timestamp metadata.)

#### Scenario: Reading with unavailable fields
- **GIVEN** a gateway is authorized for the reading's logical node
- **WHEN** a gateway sends a reading with a dynamic field unavailable as `null`
- **THEN** the corresponding column stores NULL and the reading remains valid

#### Scenario: Reading without static data
- **GIVEN** a gateway telemetry event is accepted
- **WHEN** a reading is stored
- **THEN** it contains only the 12 dynamic fields, capture timestamp, gateway/logical-node event identity, and permitted metadata, never crop type, area size, GPS, physical binding, or NDVI

#### Scenario: Query by date range
- **GIVEN** a user is authorized to view the area's readings
- **WHEN** a user queries readings for an area between two dates
- **THEN** the logical-node capture-time index serves the range efficiently

#### Scenario: Conflicting event identity is persisted
- **GIVEN** a canonical reading already exists for the event identity
- **WHEN** a second reading attempts to use an existing gateway, logical node, and event identifier with a different body
- **THEN** the database-backed identity constraint prevents creation of another canonical reading

### Requirement: Node API keys not exposed

- The system SHALL NOT return a node `api_key` in any node, gateway, property, or area response.
- Direct node API keys SHALL NOT be issued for telemetry or NDVI ingestion after the gateway contract cutover.
- Gateway credential secrets SHALL be returned only through controlled activation or rotation responses and never in subsequent reads.

(Previously: A node API key was returned once in node creation and was used for direct ingest.)

#### Scenario: Client lists nodes
- **GIVEN** a client is authorized to view a property
- **WHEN** a client lists nodes or queries `/api/v1/nodes/geo`
- **THEN** the responses contain no `api_key` field

#### Scenario: Administrator creates a logical node
- **GIVEN** an administrator is authorized to manage an irrigation area
- **WHEN** an administrator creates a logical node for an area
- **THEN** the response contains no direct-ingest credential and directs gateway setup through provisioning
