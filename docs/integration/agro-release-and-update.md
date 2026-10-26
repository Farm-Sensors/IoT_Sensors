# How Agro.io is released and updated

Agro.io is an external repository (`LastbornTen619/Agro.io`). Changes to it from this workspace follow the rule in [`README.md`](README.md): only on branches based on `integration/iot-v2`, never on Agro.io `main`. This page records how its release and update pipeline works, so cloud-side work can plan around it. Facts were verified on 2026-10-06 against the Agro.io `main` branch and one live Raspberry Pi; anything not verified is marked as such.

## Summary

- Releases are **tag-driven**, built by GitHub Actions, and published as a **GitHub Release** with one arm64 tarball.
- A Raspberry Pi **never updates itself**. A person must trigger the update, either from the Agro.io UI or by pushing the package over SSH.
- Only **published, tagged releases** can reach a device. A commit on any branch does not, until it is tagged and released.

## Pipeline

```text
tag x.y.z pushed  ──►  release-rpi.yml  ──►  GitHub Release (agroio-rpi-arm64-<version>.tar.gz)
(or workflow_dispatch)                                  │
                                                        ▼
                                  person triggers update on the device
                                  ├─ UI: "check for updates" button, then download + install
                                  └─ SSH: ops/scripts/deploy-release-to-rpi.sh <user@host> <version>
```

1. **Trigger.** `.github/workflows/release-rpi.yml` runs on a pushed tag matching `*.*.*`, or manually through `workflow_dispatch` with a `version` input.
2. **Build.** It runs `ops/scripts/package-release.sh <version>` and produces `artifacts/agroio-rpi-arm64-<version>.tar.gz`.
3. **Guard.** The workflow fails if the package contains databases (`app.db`, `*.sqlite*`), logs, exports, `github.env`, `secrets/` or `.env` files.
4. **Publish.** It creates the GitHub Release (or uploads to an existing one with `--clobber`), with generated notes.
5. **Install on the device.** Two manual paths:
   - **UI.** `GitHubReleaseUpdateService` calls `GET /repos/<repo>/releases/latest`. If the latest version differs from the running one, `LinuxReleaseInstallerService` downloads the `.tar.gz` asset and runs `install-release.sh --apply`, then restarts the services.
   - **SSH.** `deploy-release-to-rpi.sh <user@host> <version>` copies the package, then runs `install-release.sh` with `--dry-run` and later `--apply`.

## Important details

- **`releases/latest`** returns the most recent *published* release. A bare tag is not enough; the workflow is what turns a tag into a release.
- **The tag fixes the content.** The release contains whatever commit the tag points to. A tag created from `main` does not include work that lives only on `integration/iot-v2`.
- **Private repository access.** The device reads releases with a token stored in `/etc/agroio/github-release.env` (`AGROIO_GITHUB_REPOSITORY`, `AGROIO_GITHUB_TOKEN`). That file is deliberately excluded from the package. Without a valid token the GitHub API answers `404`.
- **No scheduler.** No timer or cron entry checks for Agro.io updates. The only timers on the device belong to the operating system (`apt`).
- **Not an OS image.** The device runs a regular Ubuntu install. Application versions stack up under `/opt/agroio/releases/<version>/`, and `/opt/agroio/current` is a symlink to the active one. Rolling back probably means pointing the symlink at an older release, but that was inferred from the layout and not tested. I did not find an ISO or image pipeline in the repository, but I only searched by file name and read the release workflow, not every script.

## Current test device (2026-10-26)

| Item | Value |
|---|---|
| Host | `10.32.90.229` (institutional network only) |
| OS | Ubuntu 26.04 LTS, kernel `7.0.0-1020-raspi`, aarch64 |
| Installed release | `2.0.0-alpha.25` (beta channel, built from Agro.io `feat/real-sensor-readiness`), installed under `/opt/agroio/releases/`; the stable package on the device is a local `0.9.5` build of `main` (content of `0.9.4`) |
| Services | `agroio-edge`, `agroio-ui` and `agroio-ui-webviewer`, all enabled and active |
| Agent mode | `mode: serial`, `demo_nodes: 0`, `cloud_lane: v2`, `http_sync` disabled with an empty endpoint |
| Gateway identity | `activation_state: unactivated`: no gateway/property and no credential, so no heartbeat or configuration poll is sent |
| Local data | 50 972 measurements, 8 497 raw readings, 16 512 alerts; `sync_queue` holds 110 437 historical rows (none pending) |
| NDVI | latest-point file present (`mesh-DEMO01`); `ndvi.irrigation_areas` is empty, so nothing is queued |
| Channels | `beta → stable → beta` verified on 2026-10-26 with no data loss; only beta carries the v2 lane. The UI's "check for updates" button is not channel-aware: on a beta device with a GitHub token it would offer the stable release and bypass the channel script |

## Observed device state (2026-10-06, historical)

| Item | Value |
|---|---|
| Host | `10.32.90.229` (institutional network only) |
| OS | Ubuntu 26.04 LTS, aarch64 |
| Installed release | `0.9.4`, installed by hand on 2026-09-29 (`0.9.0` to `0.9.4` within about two hours) |
| Release history on disk | 54 versions, `0.1.0` to `0.9.4` |
| Services | `agroio-edge` and `agroio-ui`, both enabled and active |
| Gateway v2 module | **absent** (`edge-agent/gateway/` does not exist in the installed release) |
| Cloud sync | `http_sync` enabled, but pointing at `http://192.168.137.2:8090/api/agroio/telemetry`, which is not this cloud's `POST /api/v1/readings` |

## Consequences for the integration

- A device running `0.9.4` sends nothing to this cloud. It uses the old `http_sync` path and has no activation, binding, outbox or heartbeat code.
- For a device to talk to this cloud, a release containing the wired gateway v2 must be **installed manually**. The v2 line builds local `2.0.0-alpha.N` packages; it is not tagged.
- The v2 line is wired into the agent loop (`GatewayRuntime.tick`) and was verified live on the test device on 2026-10-08. Its current state and package contents were re-checked on 2026-10-25. See [`gateway-v2-cutover-runbook.md`](gateway-v2-cutover-runbook.md) for the cutover and rollback rules.
- Because updates are manual, the advancing requirement (task 7.4 of `edge-cloud-gateway-provisioning`) needed someone to publish the release and trigger the install on the test device. The cutover used `2.0.0-alpha.2` on 2026-10-08; the device now runs `2.0.0-alpha.24`.

## v2 line

- Agro.io v2 grows on `integration/iot-v2`, by versions. It is **never merged to Agro.io `main`**, and nothing from it is pushed to `main`.
- Releases of the v2 line use local packages `2.0.0-alpha.N`. The release workflow has no pre-release handling, and the line is not tagged (a `2.0.0-alpha.N` tag would trigger the normal release workflow).
- Production Raspberries running `0.9.x` never receive v2: they follow `releases/latest`, which stays on the `0.9.x` line.
- The test Raspberry is updated with `ops/scripts/dev-update-rpi.sh <user@host> <version> [--apply]`, which wraps `deploy-release-to-rpi.sh`, not through the UI check.

The packaging gaps from the 2026-10-06 snapshot are resolved on the v2 line and verified in `2.0.0-alpha.24`: the package includes `contracts/iot-sensors/` (v1, v2 and `SOURCE.md`), and the installer creates `/etc/agroio/secrets` with mode 0700.

## Open questions

- Whether the stored GitHub token on the device is still valid was not checked.
- Whether the UI ever triggers the update check on its own, or only from the button, was not confirmed in the code.
