# User Authentication

> Machine ingest cutover is specified in `openspec/changes/edge-cloud-gateway-provisioning/specs/security/spec.md`: gateway credentials replace node API keys. User JWT remains unchanged.

## Purpose

Defines authentication and authorization for web users: JWT access + refresh tokens, two roles (admin, client), password recovery, and the multi-tenant ownership model that scopes clients to their own data.

## Requirements

### Requirement: Login and tokens

- The system SHALL authenticate users with email + password and issue a JWT access token plus a refresh token.
- The refresh token SHALL be persisted (`tokens_refresco`) and revoked on logout or password change.
- The frontend SHALL send the access token as `Authorization: Bearer <token>`.

#### Scenario: User logs in
- **WHEN** a user logs in with valid credentials
- **THEN** the API returns an access token and a persisted refresh token

#### Scenario: User logs out
- **WHEN** a user logs out
- **THEN** the refresh token is revoked and cannot be used again

### Requirement: Roles

- The system SHALL support exactly two user roles: `admin` and `cliente`.
- Admins SHALL access all clients/properties/areas and the admin management screens.
- Clients SHALL access only their own properties, areas, and readings (ownership enforced server-side).
- The API SHALL return 403 for cross-tenant access attempts.
- Crop cycle listings without an `irrigation_area_id` filter SHALL be scoped to the client's own areas (clients SHALL NOT see other clients' cycles).

#### Scenario: Client requests another client's data

- **WHEN** a client requests readings or areas that belong to another client
- **THEN** the API returns 403 and does not leak data

#### Scenario: Client lists crop cycles without filter

- **WHEN** a client calls `GET /api/v1/crop-cycles` without filters
- **THEN** only the cycles of their own areas are returned

### Requirement: Node authentication is separate

- Node IoT authentication SHALL be fully separate from user authentication: fixed API keys via `X-API-Key`, no JWT.

#### Scenario: Node authenticates with API key
- **WHEN** a node sends a reading with `X-API-Key`
- **THEN** the backend validates the key against the nodes table without any JWT involvement

### Requirement: Password recovery

- The system SHALL support forgot/reset password flows (`/api/v1/auth/forgot-password`, `/api/v1/auth/reset-password`).
- Reset tokens SHALL be stored hashed (SHA-256), single-use, and rate-limited per email/IP.

#### Scenario: User resets password
- **WHEN** a user requests a password reset and follows the emailed link with a valid token
- **THEN** the password is updated and the reset token is invalidated

### Requirement: Login rate limiting

- The system SHALL limit login attempts per email and IP within a configurable window (`LOGIN_RATE_LIMIT_WINDOW_MINUTES`, `LOGIN_RATE_LIMIT_MAX_ATTEMPTS`).
- When the limit is exceeded, `POST /api/v1/auth/login` SHALL respond 429.

#### Scenario: Brute force attempt

- **WHEN** more than the allowed login attempts happen for the same email within the window
- **THEN** the API responds 429 until the window expires

### Requirement: CORS and secret key hardening

- CORS origins SHALL be configurable via `CORS_ORIGINS` (comma-separated env).
- `allow_credentials` SHALL only be enabled when origins are explicit (never with `*`).
- The application SHALL refuse to start with a known-default `SECRET_KEY` unless `DEBUG=true`.

#### Scenario: Production starts with default secret

- **WHEN** the backend starts with `DEBUG=false` and the default `SECRET_KEY`
- **THEN** startup fails with a clear error instead of signing JWTs with a known key

### Requirement: Self profile endpoint

- The system SHALL expose `GET /api/v1/users/me` and `PATCH /api/v1/users/me` authenticated by the current user (admin or client).
- `PATCH` SHALL allow updating the full name; the email SHALL be read-only.

#### Scenario: Client updates their name

- **WHEN** a client PATCHes their profile name
- **THEN** the response returns the updated user without exposing other users
