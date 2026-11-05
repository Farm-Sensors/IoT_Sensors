# Prototipo v2

Prototipo **navegable** del rediseño v2. HTML, CSS y JavaScript sin dependencias ni compilación; no usa nada de `frontend/`. Especificación y resultados de pruebas: `../05-prototipo-y-visual.md`.

## Abrir

```bash
cd docs/redesign/v2/prototype
python3 -m http.server 5199        # http://localhost:5199/
```

También funciona abriendo `index.html` directamente. Para pruebas: `?role=productor|admin&theme=light|dark` y la ruta en el hash, por ejemplo `?role=admin&theme=dark#/directorio?area=3&tab=ciclos`.

## Archivos

| Archivo | Contenido |
|---|---|
| `index.html` | Página mínima |
| `styles.css` | Tokens claros y oscuros, marco, componentes, móvil (≤ 860 px) |
| `data.js` | Datos de ejemplo **anonimizados** (empresa y lotes genéricos, correo `.test`). Una función genera series deterministas |
| `app.js` | Enrutador por hash, pantallas y eventos |

## Qué es simulado

Formularios, descargas, «Cerrar sesión» y mapa (ilustrativo, sin teselas). Nada se guarda ni se envía; cada formulario lo dice. Los datos de clima, NDVI y las series son de ejemplo, no mediciones.

## Probar

Desde `../audit/`: `node 40-proto-test.mjs` (rutas), `node 41-proto-interact.mjs` (interacciones y axe) y `node 42-proto-targets.mjs` (objetivos táctiles). Levantan su propio servidor temporal en `:5199` / `:5197` y lo cierran al terminar; importan Playwright desde `frontend/node_modules`.

## Si se edita

Mantener: `null` se muestra «—», nunca 0; estado con icono y texto; sin clase D; datos sin personas reales. Si hay una copia publicada como Artifact, volver a publicarla (ver `../05-prototipo-y-visual.md`).
