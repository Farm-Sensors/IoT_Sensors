# Install Binding Flow Specification

## Purpose

Defines the Agro.io InstallView touchscreen flow that pairs a gateway and binds several detected nodes to prepared cloud slots in one session. It keeps the cloud-first hierarchy: the technician explicitly chooses every slot and the cloud never infers an area. This is paired external work in Agro.io.

## Requirements

### Requirement: Pairing step

InstallView MUST show the pairing QR (of `verification_uri_complete`), the `user_code` in large type, and a countdown. It MUST offer "Try again" after expiry or denial and MUST offer the activation-reference fallback. It MUST NOT display `device_code` or the credential.

#### Scenario: Code expires on screen

- GIVEN the pairing step is visible
- WHEN the countdown reaches zero without approval
- THEN the screen shows that the code expired and offers "Try again"

### Requirement: Detected node list

After pairing, InstallView MUST list detected nodes with their UID/serial, last-seen time, latest local reading preview, and signal where captured. A node without a recent reading MUST be shown as stale, not hidden.

#### Scenario: Two nodes detected

- GIVEN discovery evidence exists for two nodes
- WHEN the technician opens step 2
- THEN both nodes are listed with preview, signal, and last-seen time

### Requirement: Explicit slot selection with suggestions

For each node, the technician MUST choose a pending slot/area from the cached configuration. When a local node name matches a cloud area name ignoring case and accents, InstallView MAY highlight that slot as a suggestion, but MUST NOT select it automatically. One slot MUST NOT be chosen for two nodes in the same session.

#### Scenario: Name match is only a suggestion

- GIVEN a node named "Nogal Norte" and a pending slot for area "nogal norte"
- WHEN step 3 opens
- THEN that slot is highlighted as suggested and no slot is selected until the technician taps one

#### Scenario: Duplicate slot choice

- GIVEN a slot is already chosen for one node
- WHEN the technician tries to choose it for another node
- THEN InstallView prevents the choice

### Requirement: Bulk confirmation through the agent

Step 4 MUST queue one candidate submission per selected node and then one confirmation per accepted candidate through `gateway_commands` and payload files. InstallView MUST NOT call the cloud directly. Each node MUST show its resulting binding status, and failures MUST NOT block the other nodes (partial activation).

#### Scenario: One binding fails

- GIVEN three nodes are selected
- WHEN the cloud rejects one candidate and accepts two
- THEN two rows show `confirmed` after the next configuration poll and one row shows the rejection reason
- AND the technician can retry only the failed node

#### Scenario: No direct cloud access from the UI

- GIVEN the bulk confirmation runs
- WHEN network traffic from the UI process is inspected
- THEN the UI made no HTTP requests; only the agent contacted the cloud
