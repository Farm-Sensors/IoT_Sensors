# Prototipo v2 final: propuesta A (Levantamiento)

Identidad **elegida por el usuario** (2026-11-01) entre A, B y C. Misma UX del prototipo original, con mapa real y la estética de A pulida para escritorio, tableta y móvil. **La implementación en la app real sigue sin iniciarse**; este prototipo es la referencia visual.

## Abrir

```bash
cd docs/redesign/v2/prototype-a
python3 -m http.server 5199        # http://localhost:5199/
```

Necesita internet para el mapa (MapLibre, OpenFreeMap, CARTO, Esri) y las fuentes (Geist, Geist Mono). Sin red, el mapa cae a una ilustración con aviso y las fuentes a las del sistema. Parámetros: `?role=productor|admin&theme=light|dark&layer=mapa|sat` y la ruta en el hash.

## Estructura de pantallas (decisión del usuario, 2026-11-01)

El resumen y el mapa **no comparten pantalla**:
- **Mis predios** (portada del productor) es un **resumen con gráficas**: 4 cifras clave (humedad media, flujo ahora, E.T.O. media, áreas con atención), humedad por área en 24 h, flujo de agua total por hora, barra de estado de las áreas y la lista por predio con «Atención» arriba.
- **Mapa** es una **página aparte** (`#/mapa`, pestaña propia): mapa real con capas Mapa y Satélite, chips por predio y ventana con «Abrir área».
- **Hoy** (portada del admin) reemplaza el mapa por gráficas (estado de las áreas y lecturas por hora); el mapa del admin está en **Red › Mapa**.
- El mapa pequeño de **Área › Ahora y Detalles** (ubicación del nodo) y el de **Directorio › Nodo** se conservan: son contexto de un solo nodo.

Navegación del productor: Mis predios, Mapa, Cuenta.

## Puntos de quiebre

| Ancho | Composición |
|---|---|
| ≥ 1100 px | Riel lateral de 208 px. Mis predios: cifras en 4 columnas, gráficas lado a lado y lista a ancho completo |
| 861 a 1099 px | Riel lateral. Gráficas apiladas; Hoy y Área en una columna |
| ≤ 860 px | Barra superior y pestañas inferiores (2 del productor, 4 del admin). Cifras en 2 columnas, gráficas con desplazamiento horizontal propio, filas apiladas, controles de 44 px |

## Sistema visual (resumen)

Neutros fríos, **un solo acento** (azul tinta `#1b3a64` claro, `#a9c1ee` oscuro), estado con icono y texto (verde, ámbar, neutro), **un solo radio de 4 px**, líneas finas en lugar de cajas, Geist para el texto y Geist Mono solo para cifras. Detalle de tokens en `styles.css` (primeras líneas de la sección A).

## Archivos

`index.html`, `styles.css` (base funcional + identidad A + pulido final; las reglas conservan el prefijo `html[data-variant="a"]`, que se puede quitar al implementar), `app.js`, `data.js`.

## Datos y licencias

Datos ficticios; coordenadas sobre zona agrícola real (valle de Delicias). El satélite es de Esri solo para el prototipo: revisar sus términos o elegir otro proveedor antes de producción.
