## ADDED Requirements

### Requirement: One-command local stack

The repository SHALL provide `make dev`, which brings up MySQL, the backend on port 5050, the
frontend on port 5173, demo data and a live simulator for the seeded property 1, using only
Docker, uv, Node.js and Python on the developer's machine.

#### Scenario: First run on a clean clone

- **WHEN** a developer runs `make dev` on a fresh clone with the prerequisites installed
- **THEN** the command finishes with a summary, `http://localhost:5173/` shows the login, and the
  client `alan2203mx@gmail.com`, choosing predio «DEMO - Rancho Norte» and área «DEMO - Nogal
  Norte» on the dashboard, sees a last reading less than 2 minutes old after the simulator's
  first cycle

#### Scenario: Second run is idempotent

- **WHEN** `make dev` runs again while the stack is up
- **THEN** no second backend, frontend or simulator process starts, no new gateway is created,
  and demo data is not reloaded

#### Scenario: Missing prerequisite

- **WHEN** a prerequisite is missing or a required port is used by another program
- **THEN** the command stops before changing anything and prints which one, in Spanish

### Requirement: Stop and reset

`make dev-down` SHALL stop only this stack's processes and the MySQL container and keep the
data. `make dev-reset` SHALL remove the local database and `.dev/` only after explicit
confirmation.

#### Scenario: Stop keeps data

- **WHEN** a developer runs `make dev-down` and then `make dev`
- **THEN** the previous readings are still there and the same gateway credential is reused

#### Scenario: Reset needs confirmation

- **WHEN** a developer runs `make dev-reset` and answers anything other than `si`
- **THEN** nothing is deleted
