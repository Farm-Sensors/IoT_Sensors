# Propuestas visuales v2 (A, B y C)

Tres identidades visuales del **mismo prototipo**: misma navegación, mismas pantallas, mismos datos y mismos flujos que `../prototype/`. Solo cambia la parte visual y la composición. Documento de decisión: `../10-propuestas-visuales.md`. **Ninguna está aprobada.**

## Abrir

```bash
cd docs/redesign/v2/variants
python3 -m http.server 5199        # http://localhost:5199/
```

El selector **A / B / C** está en la barra superior «PROPUESTA». Parámetros: `?variant=a|b|c&role=productor|admin&theme=light|dark` y la ruta en el hash (`#/predios`, `#/area/1`, `#/hoy`, `#/directorio?area=3&tab=ciclos`).

Las tipografías se piden a Google Fonts; **sin red** se usan las del sistema y el aspecto cambia (sobre todo en B y C).

## Archivos

| Archivo | Contenido |
|---|---|
| `index.html` | Carga fuentes y las cuatro hojas |
| `base.css` | Esqueleto funcional del prototipo original (layout y comportamiento). Las propuestas lo sobrescriben |
| `a.css`, `b.css`, `c.css` | Una identidad cada una, acotada con `html[data-variant="…"]`, con modo claro y oscuro y reglas de escritorio y móvil |
| `app.js`, `data.js` | Copia del prototipo con tres cambios: selector de propuesta, variable `--pct` (humedad) para los medidores y el arreglo de clics (`$app.contains`) |

## Pruebas

Desde `../audit/`: `node 50-variants-shots.mjs` (capturas, desbordes, errores, axe, objetivos táctiles) y `node 41-proto-interact.mjs ../variants/ a|b|c` (47 interacciones + axe). Capturas en `../audit/results/variants/`.
