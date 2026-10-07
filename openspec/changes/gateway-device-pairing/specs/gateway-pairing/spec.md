# Gateway Pairing Specification

## Purpose

Defines a device-authorization pairing path, in the style of RFC 8628, through which an unactivated gateway obtains its gateway credential after an administrator approves a short code shown on the device. It is additive to edge-cloud v2: activation by single-use reference remains available and unchanged. Pairing never creates clients, properties, areas, logical nodes, or bindings.

## Requirements

### Requirement: Credential-less pairing session start

The system MUST allow a caller without credentials to start a pairing session when `GATEWAY_PAIRING_ENABLED` is true. The response MUST contain a high-entropy `device_code`, a `user_code` of 8 characters from the configured unambiguous alphabet displayed as `XXXX-XXXX`, `verification_uri`, `verification_uri_complete`, `expires_in`, and `interval`. Device-reported metadata MAY be supplied, MUST be length-bounded, and MUST NOT influence authorization. The system MUST store only a hash of `device_code` and a keyed HMAC of the normalized `user_code`.

#### Scenario: Gateway starts a pairing session

- GIVEN pairing is enabled
- WHEN a caller posts a valid start request with device metadata
- THEN the system returns `201` with `device_code`, `user_code`, both verification URIs, `expires_in` of 600 and `interval` of 5
- AND the stored session contains neither the raw `device_code` nor the raw `user_code`

#### Scenario: Pairing disabled

- GIVEN `GATEWAY_PAIRING_ENABLED` is false
- WHEN a caller starts a pairing session
- THEN the system returns `503` with code `pairing_unavailable` and creates no session

#### Scenario: Start limit exceeded

- GIVEN a source IP has started 5 sessions in the last 10 minutes, or 50 sessions are pending
- WHEN another start request arrives
- THEN the system returns `429` and creates no session

### Requirement: Token polling

The system MUST accept token polls carrying `device_code`. It MUST return `authorization_pending` while pending, `slow_down` with an increased interval when polled faster than the session interval, `expired_token` after expiry, and `access_denied` after denial, cancellation, or loss of the target gateway's pending state. Unknown, malformed, or consumed `device_code` values MUST return the same `401` response. On the first poll after approval, the system MUST atomically consume the session, move the approved gateway from `pending_activation` to `active`, issue a new gateway credential, revoke outstanding activation references for that gateway, and return a body identical in shape to the activation response.

#### Scenario: Pending session

- GIVEN a pending session
- WHEN the device polls at or after its interval
- THEN the system returns `400` with code `authorization_pending`

#### Scenario: Polling too fast

- GIVEN a pending session with interval 5 seconds polled 2 seconds ago
- WHEN the device polls again
- THEN the system returns `400` with code `slow_down` and `interval` 10
- AND later polls faster than 10 seconds also return `slow_down`

#### Scenario: Approved session is redeemed once

- GIVEN a session approved for a `pending_activation` gateway
- WHEN the device polls with its `device_code`
- THEN the system returns `200` with `gateway_id`, `property_id`, and a `gk_` credential
- AND the gateway is `active`, its outstanding activation references are revoked, and the session is `consumed`
- AND a second poll with the same `device_code` returns `401` without issuing another credential

#### Scenario: Gateway activated by reference before redemption

- GIVEN a session approved for a gateway
- AND that gateway was activated through `POST /api/v1/gateways/activate` before the device polled
- WHEN the device polls
- THEN the system returns `400` with code `access_denied` and issues no credential

#### Scenario: Expired session

- GIVEN a session whose expiry has passed without redemption
- WHEN the device polls
- THEN the system returns `400` with code `expired_token`

### Requirement: Administrator approval and denial

Only an authenticated administrator MUST be able to look up, approve, or deny a session. Lookup MUST accept a typed or URL-provided `user_code`, normalize it, and return the session's public id, status, request and expiry times, device-reported metadata, and coarse source network. Unknown, expired, consumed, and denied codes MUST produce the same not-found response. Approval MUST require the matching `user_code`, an explicit confirmation flag, and a gateway in `pending_activation`. Denial MUST require the matching `user_code`.

#### Scenario: Admin approves a pending session

- GIVEN a pending session and a gateway in `pending_activation`
- WHEN an administrator approves the session with its `user_code`, that gateway, and `confirm: true`
- THEN the session becomes `approved` for that gateway and records the approving administrator and time

#### Scenario: Non-admin attempts approval

- GIVEN a pending session
- WHEN a client user or an unauthenticated caller attempts lookup or approval
- THEN the system rejects the request and the session stays pending

#### Scenario: Approval targets an active gateway without rotation

- GIVEN a pending session and a gateway that is already `active`
- WHEN an administrator attempts to approve the session for that gateway without `replace_credential: true`
- THEN the system returns `409` and the session stays pending

#### Scenario: Admin denies a session

- GIVEN a pending session
- WHEN an administrator denies it with its `user_code`
- THEN the session becomes `denied` and the device's next poll returns `access_denied`

### Requirement: Guess and abuse resistance

The system MUST limit failed lookups and approvals to 10 per administrator and per source IP in 15 minutes, then reject further attempts for 15 minutes. Five wrong `user_code` attempts against one session MUST deny that session. Code comparisons MUST be constant-time. Raw codes and credentials MUST NOT appear in logs, error bodies, or any response other than the single credential issuance.

#### Scenario: Repeated wrong codes lock out the administrator

- GIVEN an administrator has submitted 10 unknown codes in 15 minutes
- WHEN the administrator submits another code, including a valid one
- THEN the system returns `429` and reveals nothing about the code

#### Scenario: Logs remain secret-free

- GIVEN a full pairing flow from start to redemption
- WHEN the application logs are inspected
- THEN they contain session ids and outcomes but no `device_code`, `user_code`, or credential

### Requirement: Activation by reference is preserved

Introducing pairing MUST NOT change the request, response, error, or retry behavior of `POST /api/v1/gateways/activate` or of activation-reference issuance.

#### Scenario: Reference activation still works with pairing enabled

- GIVEN pairing is enabled and a gateway has an unused activation reference
- WHEN the gateway activates with that reference
- THEN activation succeeds exactly as before, and a session already approved for that gateway's activation ends as `access_denied` on its next token poll

### Requirement: Re-pair with credential rotation

The system MUST allow an administrator to approve a session for an `active` gateway only when the request sets `replace_credential: true`. Redemption MUST issue a new credential, revoke the previous one in the same transaction, and keep the gateway, its slots, its configuration and its bindings. The system MUST reject `replace_credential: true` for a gateway that is not `active`, and MUST reject an approval for an `active` gateway without it.

#### Scenario: Rotation keeps bindings

- GIVEN an `active` gateway with a confirmed binding
- WHEN an administrator approves a new session for it with `replace_credential: true` and the device redeems the token
- THEN the device receives a new credential, the previous credential is rejected on its next request, and the confirmed binding is unchanged

#### Scenario: Rotation requires explicit confirmation

- GIVEN an `active` gateway
- WHEN an administrator approves a session for it without `replace_credential: true`
- THEN the approval is rejected and the gateway's credential is unchanged
