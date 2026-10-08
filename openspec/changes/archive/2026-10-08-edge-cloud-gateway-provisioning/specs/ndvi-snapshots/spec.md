# NDVI Snapshots Specification

## Purpose

Defines gateway-authenticated ingestion and retrieval of the latest point-sampled NDVI snapshot. NDVI remains a separate provenance-bearing event and storage model, never a telemetry field or history series.

## Requirements

### Requirement: Gateway-authorized latest-point NDVI ingestion

The system MUST accept a latest-point NDVI event only from an authenticated gateway and only for an irrigation area authorized by that gateway's active configuration. The event MUST conform to the NDVI v2 operation in `../../machine-contract.md` and, once separately authorized for publication, `contracts/edge-cloud/v2/ndvi.schema.json`, including provider, `sentinel-2-l2a` collection, scene identity, UTC scene observation time, cloud-cover percentage, and `sample_method=point`. The v2 contract is normative after gateway cutover; v1 is historical only.

#### Scenario: Gateway submits an authorized point NDVI snapshot

- GIVEN an active gateway configuration authorizes an irrigation area
- WHEN the gateway submits a valid latest-point NDVI event for that area
- THEN the system stores the snapshot with its Sentinel-2 provenance and returns successful acceptance

#### Scenario: Gateway submits NDVI for an unauthorized area

- GIVEN an active gateway is configured for property A
- WHEN it submits a valid-shaped NDVI event for an area outside property A
- THEN the system rejects the event and does not store a snapshot

#### Scenario: Gateway submits polygon NDVI

- GIVEN an authenticated gateway
- WHEN it submits an NDVI event whose sample method is not `point`
- THEN the system rejects the event and does not create a snapshot

### Requirement: Separate NDVI semantics and replay handling

The system MUST store at most the current latest-point snapshot for an irrigation area and MUST NOT add NDVI to telemetry payloads, reading rows, dashboard telemetry fields, or reading exports. NDVI replay detection MUST use scene identity plus the complete payload; an exact replay MUST return the existing snapshot, while reuse of a scene identity with a different payload MUST be rejected without overwriting the stored snapshot.

#### Scenario: Exact NDVI replay

- GIVEN a gateway successfully stored a point NDVI snapshot for a scene
- WHEN it submits the same scene identity and identical payload again
- THEN the system returns the existing snapshot and creates no additional record

#### Scenario: Conflicting NDVI scene replay

- GIVEN a point NDVI snapshot exists for a scene identity
- WHEN a gateway submits that scene identity with a different NDVI value or provenance payload
- THEN the system rejects the conflict and preserves the existing snapshot

#### Scenario: Telemetry includes NDVI

- GIVEN an authenticated gateway submits a telemetry event
- WHEN the body contains an NDVI field
- THEN the telemetry request is rejected by the telemetry contract and no NDVI value is stored in a reading

### Requirement: Latest-point NDVI retrieval

The system MUST expose the current NDVI snapshot only to users authorized to view its irrigation area. The response MUST identify the snapshot as a latest point sample and include its provenance. The system MUST NOT provide polygon sampling or NDVI history through this capability.

#### Scenario: Authorized client retrieves latest NDVI

- GIVEN a client owns an irrigation area with a latest NDVI snapshot
- WHEN the client requests that area's NDVI snapshot
- THEN the system returns the latest point sample and its provenance

#### Scenario: Client requests another client's NDVI

- GIVEN a client does not own an irrigation area
- WHEN the client requests its NDVI snapshot
- THEN the system denies access and does not disclose the snapshot
