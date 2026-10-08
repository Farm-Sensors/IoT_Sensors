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

## Observed device state (2026-10-06)

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
- For a device to talk to this cloud, a release containing the wired gateway v2 must be **tagged and published**, then **installed manually** on that device.
- When this page was verified (2026-10-06), Agro.io `integration/iot-v2` held the gateway code but did not call it from the agent loop, so tagging that branch alone would not have made telemetry flow. The v2 line has since been wired (headless harness smoke on 2026-10-06, evidence in Agro.io `odd/tasks/wire-gateway-v2.md`); that wiring was not re-verified from this repository. See [`gateway-v2-cutover-runbook.md`](gateway-v2-cutover-runbook.md) for the cutover and rollback rules.
- Because updates are manual, the advancing requirement (task 7.4 of `edge-cloud-gateway-provisioning`) needs someone to publish the release and trigger the install on the test device. That was done on 2026-10-08: release `2.0.0-alpha.2` was published and installed on the test device `10.32.90.229`, which produced the validated cutover recorded in [`gateway-v2-cutover-runbook.md`](gateway-v2-cutover-runbook.md).

## v2 line

- Agro.io v2 grows on `integration/iot-v2`, by versions. It is **never merged to Agro.io `main`**, and nothing from it is pushed to `main`.
- Releases of the v2 line use pre-release tags `2.0.0-alpha.N`. This is a decision taken on 2026-10-07, recorded here; it is **to be implemented** in Agro.io's release workflow, which will mark any tag containing `-` as a GitHub pre-release so that `releases/latest` ignores it.
- Production Raspberries running `0.9.x` never receive v2: they follow `releases/latest`, which stays on the `0.9.x` line.
- The test Raspberry is updated with `ops/scripts/deploy-release-to-rpi.sh <user@host> <version>`, not through the UI check.

Packaging gaps verified on 2026-10-06 and **being fixed on the v2 line** (not yet confirmed fixed): the release package omits `contracts/`, and the install defines no `RuntimeDirectory` or secrets directory for the gateway credential.

## Open questions

- Whether the stored GitHub token on the device is still valid was not checked.
- Whether the UI ever triggers the update check on its own, or only from the button, was not confirmed in the code.
