# Prototipo y dirección visual

> **Prototipo CONSTRUIDO el 2026-10-31** en `prototype/` (ver [Prototipo construido](#prototipo-construido)). El resto de este documento es la especificación aprobada, que el prototipo cumple; los colores y la tipografía ya están fijados en `prototype/styles.css`.

## Requisitos del prototipo

- **Navegable e interactivo**, no maquetas estáticas: recorrer pantallas, entrar a áreas, cambiar de sección y probar escritorio y móvil.
- Pantallas: **Mis predios, Área, Hoy, Directorio**, en claro y oscuro.
- Página independiente en `docs/redesign/v2/prototype/`, **sin tocar `frontend/`**. Publicarla además como Artifact privado para abrirla con un enlace.
- Datos: copia estática de la API de la base aislada, sustituyendo correos y nombres personales. Debe mostrar un área al día, una sin comunicación y una sin datos.
- Formularios simulados: nada se guarda, y debe verse qué partes son simuladas.
- Solo clases A y B de `02-arquitectura.md`. Lo de clase C, marcado como pendiente. Nada de clase D.
- No reutiliza componentes, estilos ni layouts de v1.
- Probarlo con Playwright a 390 y 1366 px antes de presentarlo.

## Dirección visual: instrumento de campo

Dato primero y decoración cero. La identidad es nueva, por decisión del usuario.

| Elemento | Decisión |
|---|---|
| Color | Superficies neutras; verde profundo solo para acción y estado; ámbar y rojo solo para estado. Sin crema ni arena |
| Tipografía | Una familia sans; cifras tabulares grandes. Se retira Playfair |
| Composición | Filas, reglas y secciones en lugar de tarjetas. Superficie elevada solo si flota |
| Radios | Pequeños y uniformes (6-8 px) |
| Estados | Icono y texto; nunca solo color. Alto contraste para móvil al sol |
| Formularios | Panel lateral en escritorio; hoja completa en móvil |
| Tablas | Densas, encabezado fijo, acciones accesibles por teclado |
| Vacíos y carga | Cada vacío indica el siguiente paso; esqueletos con la forma real |
| Movimiento | Solo si responde a una acción; sin animaciones infinitas; `prefers-reduced-motion` |

Los colores exactos y la tipografía quedaron fijados en el prototipo (ver tokens abajo). Mínimo WCAG AA en claro y oscuro, medido también en oscuro: el prototipo da 0 violaciones de axe.

## Esquemas

```
MIS PREDIOS, ESCRITORIO
┌ Sensores Agrícolas                         Cuenta ┐
│ 4 de 6 áreas reportando · 2 sin comunicación      │
├ Atención ─────────────────────────┬───────────────┤
│ ▲ Área Granja  Nogal 62.8% hace 48 h │    mapa    │
├ Rancho Norte ─────────────────────┤               │
│ ● Nogal Norte  Nogal 48.2% ahora     │            │
└───────────────────────────────────┴───────────────┘

ÁREA
┌ Mis predios › Rancho Norte › Nogal Norte ┐
│ Nogal · 12.5 ha · Datos actuales, ahora  │
│ [Ahora] [Historial] [Detalles]           │
│ HUMEDAD 48.2 % | FLUJO 0 L/min | E.T.O.  │
│ gráfica de humedad                       │
└──────────────────────────────────────────┘

HOY (ADMIN)
┌ Hoy  Clientes  Red  Ajustes       Cuenta ┐
│ ▲ 2 áreas sin comunicación         Ver   │
│ ▲ 1 equipo falta vincular     Vincular   │
│ ● 3 áreas sin ciclo activo  Crear ciclo  │
└──────────────────────────────────────────┘

DIRECTORIO
┌ Árbol ────────────┬ Área: Nogal Norte ───┐
│ ▾ Agrícola Norte  │ [Resumen][Ciclos][Nodo]│
│   ▾ Rancho Norte  │ Cultivo, tamaño      │
│     • Nogal Norte │ Siguiente paso       │
└───────────────────┴──────────────────────┘
```

Las cifras son ilustrativas.

## Prototipo construido

**Ubicación:** `docs/redesign/v2/prototype/` (`index.html`, `styles.css`, `app.js`, `data.js`; sin dependencias, sin compilación, sin red).
**Enlace privado (Artifact):** https://claude.ai/artifact/YWgz8cJeaa6GFL9dCSGNdC. Es una copia en un solo archivo de los mismos cuatro ficheros; si se cambia el prototipo, hay que volver a publicarla.

### Cómo abrirlo

```bash
cd docs/redesign/v2/prototype && python3 -m http.server 5199   # http://localhost:5199/
# también abre directo con file://…/index.html
```

Parámetros de URL para pruebas: `?role=productor|admin&theme=light|dark` y la ruta en el hash (`#/area/1/historial`).

### Qué incluye

| Pantalla | Ruta (hash) | Rol | Qué se puede hacer |
|---|---|---|---|
| **Mis predios** | `#/predios` | Productor | Resumen con gráficas (cifras clave, humedad por área en 24 h, flujo total, estado de las áreas), grupo **Atención** y filas por predio. **El mapa es la página aparte `#/mapa`** (esto es de la versión final `prototype-a/`; el prototipo original `prototype/` conserva Lista/Mapa juntos) |
| **Área** | `#/area/:id`, `/historial`, `/detalles` | Productor | Ahora (3 datos prioritarios, gráfica, suelo, ambiente, clima de referencia, NDVI), Historial (presets, ciclo, métrica, tabla paginada, descargas simuladas), Detalles |
| **Cuenta** | `#/cuenta` | Productor | Perfil con edición simulada; «Plan» y «Contraseña» marcados como decisión pendiente |
| **Hoy** | `#/hoy` | Admin | 5 pendientes con enlace que lleva al paso correcto, totales, atajos |
| **Directorio** | `#/directorio?area=3&tab=ciclos` | Admin | Árbol cliente › predio › área, panel de la selección, «Siguiente paso», pestañas del área (Resumen, Ciclos, Nodo); en móvil, dos niveles con «Volver» |
| Red y Ajustes | `#/red/*`, `#/ajustes/*` | Admin | **Maqueta mínima** para completar la navegación (equipos, nodos, mapa; catálogo, auditoría) |

Barra superior «PROTOTIPO» fija en toda pantalla con el selector de rol (Productor/Admin) y tema (Claro/Oscuro). Escritorio: barra superior; móvil (≤ 860 px): pestañas inferiores con **todos** los destinos visibles (2 del productor, 4 del admin).

### Estados de datos representados

Al día (3 áreas), sin comunicación (Maíz Lote 2, 48 h, valores atenuados y aviso), sin datos (Manzana Alta, guiones), sin nodo (Algodón Bajo), campo `null` (potencial hídrico de Chile Principal: «—», nunca 0), predio sin ubicación («Sin ubicación registrada»), riego encendido y apagado, áreas con y sin ciclo, equipo pendiente.

### Lo que es simulado

Todos los formularios (panel lateral en escritorio, hoja completa en móvil) llevan la etiqueta **DEMOSTRACIÓN · no guarda**, y «Guardar (simulado)» solo muestra un aviso. Las descargas (CSV, Excel, PDF) solo muestran un aviso. Mapa ilustrativo sin teselas. «Cerrar sesión» no hace nada. Clima, NDVI y las series son valores de ejemplo, no mediciones.

### Alcance respecto de las clases de cambio

Solo clases A y B (`02-arquitectura.md`). Clase C («Ver como cliente»): aparece como recuadro punteado «pendiente de autorización», sin pantalla. Clase D (búsqueda global, compartir áreas, anterior/siguiente entre áreas): **ausente**.

### Datos

`data.js`: una empresa de ejemplo («Agrícola Demo Norte»), 2 predios, 6 áreas, nombres genéricos de cultivo y de lote, correo `contacto@ejemplo.test`. **Nada proviene de personas reales** ni de la base de datos (la forma sí está tomada de la API: `nodes/geo`, lecturas, ciclos). Las series se generan de forma determinista.

### Tokens (resumen)

| Token | Claro | Oscuro |
|---|---|---|
| Fondo / superficie | `#f3f5f4` / `#ffffff` | `#0d1310` / `#151d19` |
| Texto / secundario | `#121c17` / `#4d5b54` | `#e9f0ec` / `#a2b1aa` |
| Acción (verde profundo) | `#0b5a39` sobre texto `#ffffff` | `#56c88e` sobre `#05160d` |
| Al día | `#0b5a39` en `#dcefe5` | `#67d49d` en `#183326` |
| Sin comunicación (ámbar) | `#7a4b00` en `#fdefc8` | `#f2bd52` en `#36290b` |
| Sin datos / sin nodo (neutro) | `#4d5b54` en `#e3e8e5` | `#a2b1aa` en `#232e29` |
| Radios | 6 y 8 px | igual |
| Tipografía | Una familia sans del sistema (`ui-sans-serif, system-ui…`); cifras con `tabular-nums`; datos prioritarios a 44 px | igual |

Decisión: **no se carga ninguna fuente externa** (funciona sin red). En la implementación se puede fijar una familia concreta; el criterio es que sea sans y tenga cifras tabulares.

### Pruebas con Playwright (2026-10-31)

Scripts: `audit/40-proto-test.mjs` y `audit/41-proto-interact.mjs`.

| Prueba | Resultado |
|---|---|
| 60 combinaciones de ruta × rol × tema × viewport (1366 y 390) | 0 con desborde horizontal, 0 sin título, 0 errores de consola |
| 47 interacciones (cambio de rol, pin → área, presets, métrica, paginación, descarga simulada, formulario, Escape, árbol/volver en móvil, estados sin datos, `null` ≠ 0, predio sin ubicación) | **47 de 47** |
| axe WCAG 2.1 A/AA, 4 combinaciones de viewport y tema, 7 rutas por rol | **0 violaciones** |

| Objetivos táctiles en 390 px (`audit/42-proto-targets.mjs`): 8 rutas, menús, filas, pestañas y botones | **0 por debajo de 44 px** (la primera medición dio 66; se corrigió) |

Capturas de las pruebas: `audit/results/proto/` (20 imágenes). **Límites:** el mapa es ilustrativo y no se probó con teselas reales; no se probó con lector de pantalla; la barra «PROTOTIPO» (no es parte del producto) queda fuera de la medición táctil; el prototipo no se probó en navegadores distintos de Chromium.
