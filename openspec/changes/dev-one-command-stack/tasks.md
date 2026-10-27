# Tasks

- [ ] 1. Add `.dev/` to `.gitignore`.
- [ ] 2. Write `scripts/dev_up.sh` exactly as in `design.md` (steps 1–10 with 1b, process-group rule).
- [ ] 3. Write `scripts/dev_down.sh` with `--reset` as in `design.md`.
- [ ] 4. Add Makefile targets `dev`, `dev-down`, `dev-reset` (and list them in `make help`).
- [ ] 5. README «Desarrollo Local»: put `make dev` first as the recommended path, keep the manual
      steps 0–5 below it as "paso a paso", and add the one-stack-per-machine note.
- [ ] 6. `docs/operations.md`: short "Entorno local" section pointing to the targets and `.dev/`.
- [ ] 7. Run the Verification block of `proposal.md` on a fresh clone; paste the terminal output
      (credentials masked) and a screenshot of the client dashboard in the PR.
- [ ] 8. Run `bash -n` and, if installed, `shellcheck` on both scripts; fix findings.
