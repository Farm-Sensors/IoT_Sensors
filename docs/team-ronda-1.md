# Ronda 1 de trabajo: orden y puertas de inicio

Fuente única del orden de los issues de la ronda 1. Cada carpeta de `openspec/changes/` repite su
puerta de inicio en `proposal.md` → «Start gate». **Nadie empieza un issue cuya puerta no está
abierta**, aunque tenga tiempo libre: en ese caso lee las specs y revisa PRs de otros con el
stack local.

Una puerta está abierta cuando el issue que la bloquea está **cerrado** en GitHub **y** el archivo
de comprobación existe en `origin/main` (IoT_Sensors) o `origin/integration/iot-v2` (Agro.io):

```bash
git fetch origin && git cat-file -e origin/main:<archivo> && echo abierta
```

| Orden | Change | Responsable | Repo → rama destino | Bloqueado por | Comprobación de la puerta |
|---|---|---|---|---|---|
| Ricky 1 | `dev-one-command-stack` (IoT #55) | Ricky | IoT → `main` | — | — |
| Ricky 1b | `dev-local-integration-run` (Agro #31) | Ricky | Agro → `integration/iot-v2` (nunca `main`) | — (usa los pasos del README de IoT) | — |
| Ricky 2 | `e2e-critical-flows` (IoT #56) | Ricky | IoT → `main` | `dev-one-command-stack` | `scripts/dev_up.sh` existe en `origin/main` |
| Fabián 1 | `e2e-client-flows` (IoT #57) | Fabián | IoT → `main` | `e2e-critical-flows` | `frontend/e2e/fixtures.ts` existe en `origin/main` |
| Fabián 2 | `a11y-automated-checks` (IoT #58) | Fabián | IoT → `main` | `e2e-client-flows` | `frontend/e2e/history-export.spec.ts` existe en `origin/main` |
| JP 1 | `ui-redesign-1-shell-and-patterns` (IoT #59) | JP | IoT → `main` | — | — |
| JP 2 | `ui-redesign-2-client-dashboard` (IoT #60) | JP | IoT → `main` | `ui-redesign-1-shell-and-patterns` | `docs/design-system.md` en `origin/main` tiene «Patrones de pantalla» |
| JP 3 | `ui-redesign-3-history-export-map` (IoT #61) | JP | IoT → `main` | `ui-redesign-2-client-dashboard` | su issue cerrado |
| JP 4 | `ui-redesign-4-admin-pages` (IoT #62) | JP | IoT → `main` | `ui-redesign-3-history-export-map` | su issue cerrado |

Reglas:

- Ricky hace primero `dev-one-command-stack`; `dev-local-integration-run` (1b) puede ir en
  paralelo porque es otro repo, pero `e2e-critical-flows` no empieza hasta que `make dev` está en `main`.
- JP hace sus cuatro cambios **uno tras otro** (1 → 2 → 3 → 4), un PR abierto a la vez, para que
  cada uno parta del anterior ya revisado.
- Fabián hace `e2e-client-flows` y luego `a11y-automated-checks`, un PR a la vez.
- Un PR por issue. Si un issue resulta más grande, se pregunta en el issue antes de partirlo.
- Alan revisa y fusiona en este orden; un PR que se adelanta a su puerta se cierra sin revisar.
