# Propuestas visuales v2, ronda 2 (A y B)

Segunda iteración después de la decisión del usuario: **A y B se quedan, C queda fuera** y el **mapa gana peso**. Misma UX y mismos datos que el prototipo original. Documento de decisión: `../10-propuestas-visuales.md` (sección «Ronda 2»). La ronda 1 (A, B y C) sigue en `../variants/`. **Ninguna propuesta está aprobada.**

## Abrir

```bash
cd docs/redesign/v2/variants-2
python3 -m http.server 5199        # http://localhost:5199/
```

**Necesita internet** para el mapa real (MapLibre desde unpkg, teselas de OpenFreeMap, CARTO y Esri) y para las fuentes (Geist, Bricolage Grotesque, Instrument Sans). Sin conexión, o en un entorno que bloquee esas descargas (como el Artifact), el mapa cae a una ilustración esquemática con un aviso, y las fuentes a las del sistema.

Selector **A / B** en la barra superior. Parámetros: `?variant=a|b&role=productor|admin&theme=light|dark&layer=mapa|sat` y la ruta en el hash.

## Qué cambia respecto de la ronda 1

- **Mapa real** (MapLibre GL, el mismo que usa la app) con capa **Mapa** y capa **Satélite**; pines con nombre, humedad y estado; al alejar, pines de **predio** («3 de 4 al día»); chips para ir a cada predio; ventana con «Abrir área».
- **Más lugares con mapa:** Mis predios (protagonista), Hoy (junto a los pendientes), Área › Ahora (ubicación del nodo), Área › Detalles y Directorio › Nodo.
- **Coordenadas de ejemplo sobre zona agrícola real** (valle de Delicias, Chihuahua) para que la capa satelital muestre cultivos reales. Los nodos, nombres y cifras siguen siendo ficticios.
- **Identidades nuevas:** A «Levantamiento» (Geist, azul tinta, líneas finas, mapa y hoja de lista) y B «Agua» (Bricolage Grotesque e Instrument Sans, verde azulado, mapa satelital como encabezado y tarjetas). Se retiraron los adornos de la ronda 1 (marcas `▍` y `>`, cuadrícula de fondo, etiquetas en mayúsculas, anillos, degradados de fondo, acento lima).

## Archivos

| Archivo | Contenido |
|---|---|
| `index.html` | MapLibre, fuentes y hojas |
| `base.css` | Esqueleto funcional (heredado de la ronda 1) y reglas del mapa |
| `a.css`, `b.css` | Una identidad cada una, claro y oscuro, escritorio y móvil |
| `app.js`, `data.js` | Prototipo con mapa real y respaldo ilustrativo |

## Pruebas

Desde `../audit/`: `node 51-variants2-shots.mjs` (32 capturas, desborde, errores, axe, objetivos táctiles) y `node 52-variants2-interact.mjs ../variants-2/ a|b` (interacciones con mapa real y respaldo sin mapa). Necesitan internet. Capturas en `../audit/results/variants-2/`.

## Licencias y datos a revisar antes de usar en producción

- **Satélite (Esri World Imagery):** se usó solo para el prototipo, con su atribución. Su uso en producción exige revisar los términos de Esri o elegir otro proveedor.
- Teselas de OpenFreeMap y CARTO: las que ya usa la app real.
