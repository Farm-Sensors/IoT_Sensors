# Delta for Security

## ADDED Requirements

### Requirement: Gateway credential protection and rotation

The system MUST protect gateway credential material at rest and MUST return a newly issued secret only through a controlled activation or rotation response. Credential material MUST NOT be returned by gateway, property, node, configuration, status, or list responses, and MUST NOT be emitted in logs, fixtures, or documentation examples. Credential rotation MUST invalidate the replaced credential at the defined boundary and preserve no secret disclosure path.

#### Scenario: Administrator rotates gateway credentials

- GIVEN an administrator is authorized to manage a property's gateway
- WHEN the administrator initiates credential rotation
- THEN the system issues the replacement secret only through the controlled response and invalidates the previous credential at the rotation boundary

#### Scenario: Gateway list response is requested

- GIVEN a user is authorized to view a property's gateway
- WHEN the user requests gateway details or status
- THEN the response contains no activation reference, credential, or credential-derived secret

#### Scenario: Unauthorized user requests rotation

- GIVEN a client does not own a property's gateway
- WHEN the client requests gateway credential rotation
- THEN the system denies the request and does not issue or reveal a credential

### Requirement: Gateway machine authorization boundaries

The system MUST authorize machine requests by the authenticated gateway's property scope and active configuration. Machine credentials MUST authorize only activation, configuration retrieval, selected-slot binding submission and confirmation, heartbeat, telemetry, NDVI, update-authorization retrieval, and update-confirmation recording explicitly assigned to that gateway. A gateway confirmation MUST be limited to its own previously submitted authorized pending candidate and slot. They MUST NOT grant user-session privileges, administrative CRUD access, cross-property access, or physical actuator control. User JWTs MUST NOT be stored, transmitted, or persisted on edge.

#### Scenario: Gateway attempts an administrative request

- GIVEN a valid gateway credential
- WHEN the gateway calls a user administration endpoint
- THEN the system rejects the request because the machine credential is not a JWT user session

#### Scenario: Gateway attempts cross-property telemetry

- GIVEN a gateway belongs to property A
- WHEN it presents its credential with an area or logical node from property B
- THEN the system rejects the request and records no cross-property data

#### Scenario: Gateway confirmation has no user-session authority

- GIVEN a gateway has a valid credential and a local technician selected a pending candidate slot
- WHEN the gateway confirms its own candidate
- THEN the backend authorizes the transition from gateway scope and candidate ownership without receiving an edge-stored JWT

### Requirement: Activation-token secrecy and audit safety

The system MUST issue a 24-hour one-time activation QR/token reference that contains no gateway credential or credential-derived material. The issuer is an authorized administrator and the consumer is the unactivated gateway over an online activation request. The cloud MUST persist only a protected token representation and audit-safe lifecycle metadata (issuer identity, issue, expiry, consumption, and outcome); it MUST NOT persist, log, or return token plaintext after issuance. A successful activation response MAY return only the newly issued gateway credential once; all invalid, expired, consumed, unknown, and malformed references MUST have an indistinguishable failure response.

#### Scenario: Activation response is safe to audit

- GIVEN an administrator issues an activation reference for a provisioned gateway
- WHEN the unactivated gateway consumes it online before expiry
- THEN the response returns the new gateway credential once, the reference is consumed atomically, and subsequent read/audit/log responses contain no plaintext reference or secret material

#### Scenario: Invalid activation reference does not disclose state

- GIVEN an activation reference is expired, consumed, unknown, or malformed
- WHEN a consumer attempts activation
- THEN the system returns the same failure shape, records only audit-safe outcome metadata, and issues no credential

## MODIFIED Requirements

### Requirement: Node authentication is separate

- Gateway machine authentication SHALL be fully separate from user authentication: property-scoped gateway credentials SHALL be used for gateway operations and SHALL NOT use JWT.
- Direct node API keys SHALL NOT authenticate telemetry, NDVI, heartbeat, configuration, binding, or activation requests after contract cutover.
- User JWT access and refresh authentication SHALL remain the only authentication mechanism for user-facing and administrator operations.

(Previously: Each IoT node authenticated independently with a fixed `X-API-Key`.)

#### Scenario: Gateway authenticates with its credential
- **GIVEN** the gateway has an active property-scoped credential
- **WHEN** an active gateway sends an authorized machine request with its credential
- **THEN** the backend validates the gateway and its property scope without JWT involvement

#### Scenario: Legacy node credential is used
- **GIVEN** runtime cutover is complete
- **WHEN** a request sends a former node API key to a gateway machine endpoint
- **THEN** the backend rejects the request without accepting a compatibility authentication path

#### Scenario: User calls an administrative endpoint
- **GIVEN** an administrator has a valid user session
- **WHEN** an administrator calls an administration endpoint with a valid JWT
- **THEN** the backend authorizes the user independently from gateway credentials
