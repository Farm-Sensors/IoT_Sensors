# Gateway Provisioning Specification

## Purpose

Defines the cloud-owned lifecycle for exactly one authorized edge gateway per property. It covers controlled activation, property-authoritative configuration, logical area slots, physical bindings, heartbeats, and gateway status without adding field-device control or Phase 2 automation.

## Requirements

### Requirement: Property gateway provisioning

The system MUST allow an administrator to provision no more than one gateway for a property. Provisioning MUST prepare logical node slots only for existing irrigation areas of that property and MAY assign an approved hardware profile to each slot. The system MUST NOT create a physical-device binding merely by preparing a slot.

#### Scenario: Administrator provisions a property gateway

- GIVEN a property has no gateway and has two existing irrigation areas
- WHEN an administrator provisions its gateway with prepared slots for those areas
- THEN the system creates one gateway and two logical node slots scoped to that property
- AND each slot is associated with its existing logical area node without a physical UID or serial binding

#### Scenario: Administrator attempts a second gateway for a property

- GIVEN a property already has a provisioned gateway
- WHEN an administrator attempts to provision another gateway for that property
- THEN the system rejects the request without creating another gateway

#### Scenario: Prepared slot references another property

- GIVEN an administrator provisions a gateway for one property
- WHEN the request names an irrigation area owned by another property
- THEN the system rejects the request without exposing or altering that area

### Requirement: Single-use gateway activation

The system MUST issue a single-use 24-hour QR/token reference for a provisioned gateway. The reference MUST contain no gateway credential or credential-derived material. An authorized administrator is its issuer and the unactivated gateway is its consumer through an online activation request. A successful activation MUST consume the reference atomically, establish the gateway identity, return the newly issued gateway credential only through that activation response, and retain only audit-safe issuer/issue/expiry/consumption/outcome metadata. Expired, consumed, unknown, or malformed references MUST NOT activate a gateway, disclose secret material, or reveal which failure state occurred.

#### Scenario: Gateway activates with a valid unused reference

- GIVEN a provisioned gateway has an unused activation reference issued less than 24 hours ago
- WHEN the gateway submits that reference online to activate
- THEN the system activates the gateway, consumes the reference, and returns the gateway credential once

#### Scenario: Gateway retries an already consumed activation reference

- GIVEN an activation reference was consumed by a successful activation
- WHEN the same reference is submitted again
- THEN the system rejects the request and does not issue another credential

#### Scenario: Gateway submits an expired activation reference

- GIVEN an activation reference was issued more than 24 hours ago and was not consumed
- WHEN the gateway submits the reference
- THEN the system rejects activation and leaves the gateway inactive

### Requirement: Global gateway templates and property copy

The system MUST allow an administrator to manage versioned global gateway templates. Each template version MUST define expected existing-area selectors, pending logical-node slot definitions, and hardware-profile links. Copying a selected template version to a property MUST resolve only that property's existing areas and logical nodes into an independent property working set that an administrator may review and publish. Template creation, versioning, activation, retirement, and copying MUST NOT create physical bindings, gateways, areas, or logical nodes implicitly; later template edits MUST NOT mutate already copied property working sets or published configurations.

#### Scenario: Administrator copies a template to a property

- GIVEN an active global template version defines expected areas, pending slot definitions, and hardware-profile links
- WHEN an administrator copies it to a property with matching existing irrigation areas and logical nodes
- THEN the system creates an independent property working set with unbound prepared slots and resolved profile links
- AND no physical binding, area, logical node, or gateway is created implicitly

#### Scenario: Retired template version is not used for a new copy

- GIVEN a global template version is retired
- WHEN an administrator attempts to copy that version to a property
- THEN the system rejects the copy and preserves prior property working sets unchanged

### Requirement: Authoritative versioned property configuration

The system MUST publish a monotonically increasing configuration version for each gateway property. The active configuration MUST identify the authorized gateway, prepared logical node slots, their irrigation-area identities, and their hardware profiles. A gateway MUST retrieve only the active configuration for its own property; a configuration request from another gateway or for another property MUST be denied.

#### Scenario: Gateway polls its current configuration

- GIVEN an active gateway has an active property configuration at version 4
- WHEN it polls configuration with its gateway credential
- THEN the system returns version 4 and only that gateway property's authorized logical slots

#### Scenario: Administrator publishes a revised configuration

- GIVEN a property has active configuration version 4
- WHEN an administrator publishes a valid change to a prepared slot profile
- THEN the system makes a version 5 configuration active without mutating version 4

#### Scenario: Gateway requests another property's configuration

- GIVEN two active gateways belong to different properties
- WHEN one gateway requests the other property's configuration
- THEN the system denies the request and returns no configuration content

### Requirement: Candidate binding, partial activation, and reassignment history

The system MUST use the canonical slot/binding vocabulary `unbound`, `pending_initial`, `confirmed`, and `pending_reassignment`. Before candidate submission, the local technician MUST explicitly select an existing prepared pending slot and its area. A physical UID/serial candidate is accepted only when the authenticated gateway submits that selected slot identity and it is in the gateway's active configuration; the cloud MUST NOT infer a slot or area from UID/serial. An unbound slot transitions to `pending_initial` on a candidate and to `confirmed` only when the same authenticated gateway confirms its own previously submitted authorized pending candidate for that selected slot. A confirmed slot transitions to `pending_reassignment` when a replacement candidate is proposed; its current confirmed binding remains effective until that gateway confirmation closes the prior record and makes the replacement `confirmed`. The operation MUST use the gateway credential and MUST NOT require, receive, or persist a user JWT on edge. The system MUST allow a gateway to be active while one or more slots are `unbound`, `pending_initial`, or `pending_reassignment`. Reassignment MUST preserve binding history so a reading remains associated with the logical area valid at its capture time.

#### Scenario: Gateway operates with partially bound slots

- GIVEN an activated gateway has three prepared logical slots and only two confirmed physical bindings
- WHEN it polls configuration and sends a heartbeat
- THEN the gateway remains active and the unbound slot is represented as `unbound`

#### Scenario: Gateway proposes a valid candidate binding

- GIVEN a gateway has a prepared unbound slot for an existing area
- WHEN it submits a previously unbound physical UID and serial for that slot
- THEN the system records a `pending_initial` candidate without treating it as an active binding

#### Scenario: Gateway confirms its selected reassignment candidate

- GIVEN a logical slot has a confirmed physical binding and a different candidate has been proposed
- WHEN the local technician confirms the selected candidate and the same gateway submits its gateway-authenticated confirmation
- THEN the system closes the previous binding, activates the new binding, and retains both historical binding records

#### Scenario: Gateway cannot confirm another candidate or infer a slot

- GIVEN two gateways have pending candidates in their authorized configurations
- WHEN one gateway submits a confirmation for the other gateway's candidate, or submits only UID/serial without an explicitly selected prepared slot/area
- THEN the system rejects the request without changing any binding

#### Scenario: Gateway proposes an unexpected physical device

- GIVEN a gateway submits a UID/serial not assigned to a prepared slot
- WHEN no matching candidate slot exists in its active configuration
- THEN the system rejects the candidate and does not create an area or logical node

### Requirement: Gateway heartbeat and status

The system MUST accept an authenticated gateway heartbeat at a five-minute target cadence and record the most recent accepted heartbeat. The system MUST expose simple gateway status separately from logical-node reading freshness. The canonical cloud statuses MUST map to edge-local statuses as follows: `inactive` and `never_seen` to `pending`, `recently_seen` to `connected`, `stale` to `delayed`, and `disconnected` to `disconnected`. Gateway status MUST NOT create active inactivity alerts or external notifications.

#### Scenario: Gateway reports a heartbeat

- GIVEN an active gateway with a valid credential
- WHEN it sends a heartbeat five minutes after its previous heartbeat
- THEN the system records the heartbeat and reports the gateway as recently seen

#### Scenario: Gateway status and reading freshness differ

- GIVEN a gateway sent a recent heartbeat but one logical node has no recent reading
- WHEN an authorized user views property status
- THEN the response distinguishes gateway connectivity from that logical node's reading freshness

#### Scenario: Invalid gateway heartbeat

- GIVEN a request has no valid gateway credential
- WHEN it submits a heartbeat
- THEN the system rejects the request and does not update gateway status

### Requirement: Version 2 machine contract

The version 2 machine contract MUST normatively define these operations: activation; conditional configuration polling with `304 Not Modified` only when both the submitted configuration version and binding revision match, otherwise a `200 OK` immutable configuration snapshot plus current live binding overlay; selected-slot candidate submission; gateway-authenticated candidate confirmation; heartbeat; telemetry; latest-point NDVI; update authorization retrieval; and local technician update-confirmation recording. For every operation, the contract MUST define required and optional headers, request and response schemas, success and error status codes, authorization scope, idempotency or retry semantics, and whether a retry returns an existing result, is safe, or is rejected. Machine authentication MUST use the gateway credential; edge storage or transmission of a user JWT is prohibited.

#### Scenario: Gateway polls with a stale binding overlay

- GIVEN a gateway has configuration version 4 and binding revision 8 cached
- WHEN the configuration version remains 4 but the current binding revision is 9
- THEN the server returns `200 OK` with version 4 and the current binding overlay rather than `304 Not Modified`

#### Scenario: Gateway retries a machine operation

- GIVEN a gateway retries an activation, candidate, confirmation, telemetry, NDVI, heartbeat, or update-confirmation operation after an uncertain response
- WHEN the retry conforms to that operation's defined idempotency identity
- THEN the server applies the operation-specific v2 retry semantics without duplicating an accepted state transition or event

### Requirement: Update authorization and local confirmation

The system MUST allow an authorized administrator to issue a bounded update authorization for a gateway's named locally prepared image version and immutable digest. The gateway MAY retrieve only its own active authorization with its gateway credential. After a local technician confirms that prepared image, the gateway MUST record confirmation through its own machine-authenticated operation, bound to that authorization and image identity. The system MUST NOT provide image transfer, OTA delivery, remote execution, automated rollback, or gradual rollout, and MUST NOT require, persist, or transmit a user JWT on edge.

#### Scenario: Gateway records a matching local update confirmation

- GIVEN a gateway has an active update authorization for a prepared image version and digest
- WHEN a technician confirms that exact image locally and the gateway submits the matching authorization and confirmation
- THEN the system records the confirmation for that gateway without delivering or executing an update

#### Scenario: Gateway reports a mismatched update confirmation

- GIVEN a gateway has no active authorization for an image identity
- WHEN it submits a technician confirmation for that image
- THEN the system rejects the confirmation and records no update state

### Requirement: Gateway contract cutover and documentation consistency

The system MUST publish a versioned edge-cloud gateway contract before runtime cutover. After cutover, all cloud API, security, architecture, stack, integration, simulator, fixture, OpenSpec, and project-guidance surfaces MUST identify gateway credentials and configured logical-node identities as the only ingest path. The system MUST NOT retain a dual-auth runtime window, direct node credentials, physical commands, mobile helpers, OTA, rollback automation, gradual rollout, PostgreSQL migration, or Phase 2 behavior as part of this capability.

#### Scenario: Contract consumer follows the cutover documentation

- GIVEN a contract consumer reads the published gateway contract and integration documentation after cutover
- WHEN it prepares telemetry, NDVI, configuration, and heartbeat requests
- THEN the materials consistently require gateway authentication and configured logical-node or area authorization

#### Scenario: Legacy node credential is presented after cutover

- GIVEN runtime cutover is complete
- WHEN a request attempts to ingest using only a former node API key
- THEN the system rejects the request and does not accept it through a compatibility path

### Requirement: Coordinated external acceptance contracts

The system MUST document paired acceptance contracts, without claiming their implementation in IoT_Sensors: Agro.io provides local UI first while phone assistance is deferred; a prepared image activates online, polls and caches configuration, retries its outbox, retains confirmed data for 30 days, protects pending data under disk pressure, and emits five-minute heartbeats; updates require central authorization and gateway-recorded local technician confirmation without an edge JWT. IoT_Sensors MUST provide the corresponding cloud activation, configuration, retry/replay, heartbeat, and update-authorization/confirmation boundaries. OTA delivery, automated rollback, and gradual rollout remain later work.

#### Scenario: Paired edge acceptance is recorded

- GIVEN a reviewer reads the gateway change artifacts
- WHEN it verifies external integration responsibilities
- THEN it can distinguish cloud acceptance boundaries from Agro.io-owned local implementation and later OTA/rollback/rollout work

#### Scenario: Prepared-image update is accepted

- GIVEN an edge update is proposed for a prepared image
- WHEN central authorization and technician confirmation are both recorded through the paired workflow
- THEN the update is eligible under the external acceptance contract without this capability implementing OTA execution
