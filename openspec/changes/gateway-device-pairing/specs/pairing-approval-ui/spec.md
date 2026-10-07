# Pairing Approval UI Specification

## Purpose

Defines the IoT_Sensors admin screens used to approve a device pairing and the fixes that make the existing activation-reference fallback usable without a camera.

## Requirements

### Requirement: Verification page

The frontend MUST provide a verification page at the path used by `verification_uri`. It MUST accept a typed `user_code` and MUST prefill the code from `verification_uri_complete`. An unauthenticated visitor MUST be sent to login and returned to the page with the code preserved. Only administrators MAY use the page.

#### Scenario: Admin opens the URL from the device QR

- GIVEN an administrator scans the device QR with a phone
- WHEN the verification page opens with `?code=BCDF-GHJK`
- THEN the page looks up that code and shows the session details

#### Scenario: Admin types the code

- GIVEN an administrator opens the verification page without a code
- WHEN the administrator types `bcdf ghjk`
- THEN the page normalizes it to `BCDF-GHJK` and looks it up

#### Scenario: Visitor is not logged in

- GIVEN a visitor without a session opens `verification_uri_complete`
- WHEN login completes as an administrator
- THEN the verification page opens with the original code

### Requirement: Phishing-resistant approval

Before approval, the page MUST show the code, request time, remaining time, device-reported hostname, model, and agent version labeled as reported by the device, and the coarse source network. The administrator MUST choose a `pending_activation` gateway explicitly, and MUST tick a confirmation stating that the code is shown on the device being installed. The approve action MUST stay disabled until both are done. The page MUST offer a deny action.

#### Scenario: Approve requires gateway and confirmation

- GIVEN a pending session is shown
- WHEN no gateway is selected or the confirmation is not ticked
- THEN the approve action is disabled

#### Scenario: Unknown or expired code

- GIVEN the API returns not found for a code
- WHEN the page renders the result
- THEN it shows one generic message telling the administrator to request a new code on the device

#### Scenario: Lockout

- GIVEN the API returns `429`
- WHEN the page renders the result
- THEN it shows that attempts are temporarily blocked and disables lookup

### Requirement: Activation reference is readable

The gateway management page MUST show the issued activation reference as visible monospaced text with a copy action and its expiry time, alongside the QR. The reference MUST NOT persist after navigation away from the page.

#### Scenario: Admin copies the reference

- GIVEN an administrator issues an activation reference
- WHEN the reference is displayed
- THEN the text, a copy action, and the expiry are visible
- AND after navigating away and back the reference is no longer shown

### Requirement: Provisioning errors are visible

Provisioning failures MUST be shown to the administrator with the API message. The provisioning form MUST state that each selected area needs an active logical node before provisioning.

#### Scenario: Area without an active node

- GIVEN an area has no active logical node
- WHEN an administrator provisions a gateway with that area
- THEN the page shows the `422` message and the gateway list is unchanged
