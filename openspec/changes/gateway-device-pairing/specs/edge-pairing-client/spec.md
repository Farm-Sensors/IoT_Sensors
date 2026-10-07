# Edge Pairing Client Specification

## Purpose

Defines how the Agro.io edge agent and CLI consume the pairing operations of edge-cloud v2. This is paired external work in Agro.io; IoT_Sensors does not implement it. The client stores the resulting credential exactly as activation by reference does.

## Requirements

### Requirement: Start and display a pairing session

The agent MUST start a pairing session only when the v2 lane is enabled, the vendored contract is valid, and the gateway identity is not active. It MUST keep `device_code` only in a 0600 file in the run directory and MUST expose only `user_code`, `verification_uri_complete`, expiry, and state to local display storage.

#### Scenario: Technician requests pairing

- GIVEN an unactivated gateway with a valid v2 lane
- WHEN a `pair` command is queued
- THEN the agent starts a session and the display storage shows the code, URI, and expiry
- AND SQLite, logs, and status output contain no `device_code`

#### Scenario: Gateway already active

- GIVEN the gateway identity is active and its credential file is present and readable with mode 0600
- WHEN a `pair` command is queued without an explicit re-pair flag
- THEN the agent finishes the command as `already_active` without calling the cloud

#### Scenario: Re-pair after a lost credential

- GIVEN the gateway identity is active but its credential file is missing or unreadable, or the technician explicitly requests re-pairing
- WHEN a `pair` command is queued
- THEN the agent starts a new pairing session and, on success, replaces the stored credential while keeping the cached configuration and bindings

### Requirement: Poll at the server interval

The agent MUST poll no faster than the current interval, MUST increase the interval when told `slow_down`, and MUST stop and clear the `device_code` file on `expired_token`, `access_denied`, or `401`.

#### Scenario: Slow down

- GIVEN a pending session with interval 5 seconds
- WHEN the cloud returns `slow_down` with interval 10
- THEN the next poll happens no earlier than 10 seconds later

#### Scenario: Denied

- GIVEN a pending session
- WHEN the cloud returns `access_denied`
- THEN the agent removes the `device_code` file and the display state becomes `denied`

### Requirement: Store the credential like activation

On a valid success response the agent MUST store the credential with the same 0600 credential storage and `gateway_identity` update used by activation, then remove the `device_code` file. An invalid success body MUST be treated as a failure without storing anything.

#### Scenario: Successful pairing

- GIVEN an approved session
- WHEN the poll returns `gateway_id`, `property_id`, and a `gk_` credential
- THEN the gateway identity is active, the credential is stored with mode 0600, and the display state becomes `paired`

### Requirement: Headless CLI

The CLI MUST provide `pair`, `pair --wait`, `pair-status`, and `pair-cancel`, and MUST keep `activate --reference-file`. CLI output MUST never include `device_code` or the credential.

#### Scenario: Harness pairs without a reference file

- GIVEN a harness agent with the v2 lane
- WHEN the operator runs `pair --wait` and an administrator approves the shown code
- THEN the command exits successfully and `status` shows an active gateway
