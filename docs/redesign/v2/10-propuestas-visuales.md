# Propuestas visuales v2

> **DECISIÓN (2026-11-01): el usuario eligió la propuesta A.** Versión final y pulida en `prototype-a/`. La implementación sigue sin autorizar hasta su visto bueno explícito. Antes: 
>
> **Ronda 2:** el usuario descartó **C**, conservó **A y B**, pidió **más peso para el mapa** y señaló que ambas seguían sintiéndose «diseño barato de IA». Ver la sección «Ronda 2» al final. La ronda 1 (A, B, C) se conserva en `variants/`.

> **Estado: EN REVISIÓN. Ninguna propuesta está aprobada** y la implementación de v2 sigue sin autorizar. La estética del prototipo original (`prototype/`) tampoco se da por aprobada; solo su UX.

## Decisión del usuario que origina esto

«Me gustó la UX del prototipo actual, pero no su estética.» **Se conserva:** navegación y organización de la información, distribución de secciones, flujos funcionales, jerarquía y presentación de estados (Atención, sin comunicación, sin datos, sin nodo, `null` ≠ 0). **Se explora:** identidad visual distinta, no solo colores ni tipografías.

## Dónde verlas

- **Carpeta:** `docs/redesign/v2/variants/` (`python3 -m http.server 5199` dentro de la carpeta). El selector **A / B / C** está en la barra superior, junto a Productor/Admin y Claro/Oscuro.
- **Enlace privado:** https://claude.ai/artifact/Gf8DpTSJZtcMHRocGJWkiC (solo el dueño; se comparte desde su menú «Compartir»).
- Parámetros: `?variant=a|b|c&role=productor|admin&theme=light|dark#/predios`. Pantallas: Mis predios (`#/predios`), Área (`#/area/1`), Hoy (`#/hoy`), Directorio (`#/directorio?area=3&tab=ciclos`); además Historial, Detalles, Cuenta, Red y Ajustes.
- Capturas de las 4 pantallas × 3 propuestas × escritorio y móvil × claro y oscuro (48): `audit/results/variants/`.

## Cómo se construyeron (y qué limita la comparación)

Las tres comparten el **mismo marcado, los mismos datos y el mismo JavaScript**; cada una es una hoja CSS que reescribe color, tipografía, formas **y composición** (barra o riel lateral, filas o tarjetas, medidores). Eso garantiza que la UX es idéntica, pero también limita lo que se ve: no se rediseñaron componentes con otra estructura HTML (por ejemplo, el mapa es la misma ilustración y las gráficas son las mismas series). Una propuesta aprobada se implementaría con sus propios componentes. No reutilizan nada de v1 (Playfair, crema, olivo) ni de la implementación real.

## Resumen comparativo

| | **A · Sala de control** | **B · Agua** | **C · Cartel** |
|---|---|---|---|
| Idea | Instrumento técnico de una sala de control | Superficie suave y táctil, como una aplicación de consumo | Póster suizo: tipografía gigante y reglas negras |
| Tono | Preciso, denso, sobrio | Amable, cercano, tranquilo | Contundente, directo, ruidoso |
| Navegación escritorio | **Riel lateral** fijo, etiquetas en mayúsculas mono | **Isla flotante** redondeada arriba | **Barra superior gigante** con pestañas de bloque |
| Navegación móvil | Pestañas inferiores planas | **Píldora flotante** con margen | Barra negra a todo el ancho |
| Lista de áreas | **Tabla densa** con encabezado | **Tarjetas** en cuadrícula con medidor circular | **Tabla de reglas gruesas** con cifras enormes |
| Estado | Etiqueta con borde y LED (círculo, triángulo, anillo, aspa) | Píldora suave con icono | **Bloque plano de color** (lima, amarillo, gris rayado) con borde negro |
| Forma | Radio 2–3 px, bordes de 1 px, sin sombras | Radio 22 px, sombras suaves, degradados de fondo | Radio 0, bordes de 2–6 px |
| Datos prioritarios | Tres celdas con cuadrícula de fondo y cifra mono de 56 px | Tarjeta principal azul con anillo de humedad y dos tarjetas | Tres bloques de hasta 104 px, el primero en azul cobalto |

## A · Sala de control

**Concepto.** El productor y el admin leen un instrumento: el dato es el protagonista y todo lo demás es estructura. Referencias: paneles de control, terminales, instrumentos de medición.

| Aspecto | Definición |
|---|---|
| **Paleta (claro)** | Fondo `#e8ecef`, superficie `#f6f8f9`, texto `#0e1620`, secundario `#3c4955`, línea `#aeb9c3`, acento azul `#005a85` |
| **Paleta (oscuro)** | Fondo `#0a0e12`, superficie `#11171d`, texto `#dde7ee`, acento cian `#3cc6fb`. Pensada como oscuro primero |
| **Estado** | Verde `#0a6637`/`#4fe08d`, ámbar `#774000`/`#ffb740`, neutro; siempre con **forma** distinta además de color |
| **Tipografía** | IBM Plex Sans (texto) e IBM Plex Mono (cifras, etiquetas y encabezados). Títulos en mayúsculas con espaciado |
| **Tarjetas, tablas, componentes** | Casi sin tarjetas: **tablas** y paneles con borde de 1 px; filas de 52 px; cuadrícula de fondo en los datos prioritarios; barra de humedad bajo la cifra |
| **Navegación y encabezados** | Riel lateral de 224 px con marca, destinos y cuenta abajo; título con marca `▍`; resumen con prefijo `>` |
| **Espaciado y jerarquía** | Compacto. Jerarquía por peso y mono; el color solo marca estado y acción |
| **Escritorio / móvil** | Escritorio: riel + contenido ancho. Móvil: barra superior y pestañas inferiores; filas apiladas |

**Ventajas.** Mayor densidad: cabe más por pantalla, ideal para el Directorio y las tablas del admin. Aspecto serio que comunica precisión. Implementación barata: formas planas, sin sombras ni efectos. Buen contraste en ambos temas. El riel lateral escala si crecen los destinos (Fase 2).
**Desventajas.** Fría para un productor poco técnico. La fuente mono reduce la legibilidad de textos largos. El riel quita ancho en escritorio y es la composición más distinta de la actual. Cifras de fila (18 px) más pequeñas que en C.

## B · Agua

**Concepto.** El agua como metáfora: azul profundo, medidores circulares que se llenan, bordes redondeados y navegación que flota. Pensada para sentirse como una aplicación cotidiana, no como una herramienta industrial.

| Aspecto | Definición |
|---|---|
| **Paleta (claro)** | Fondo `#e6f1f5` con luces suaves, superficie `#ffffff`, texto `#0a2735`, acento azul `#0a4a70`, destaque lima `#b9ef3a` |
| **Paleta (oscuro)** | Fondo `#07161e`, superficie `#0e2530`, acento celeste `#7dd3fc`, lima `#c8f45a` |
| **Estado** | Verde, ámbar y neutro suaves en píldoras con icono |
| **Tipografía** | Outfit (títulos y cifras) y Plus Jakarta Sans (texto): geométricas y redondeadas |
| **Tarjetas, tablas, componentes** | **Tarjetas** de 22 px con sombra; cada área es una tarjeta con **anillo de humedad**; anillo punteado cuando no hay dato; pestañas y botones en píldora |
| **Navegación y encabezados** | Isla flotante redondeada arriba (escritorio); píldora flotante abajo (móvil); resumen en una banda azul |
| **Espaciado y jerarquía** | Generoso. La jerarquía la dan el tamaño y las superficies (tarjeta azul = lo más importante) |
| **Escritorio / móvil** | Escritorio: contenido centrado en 1100 px, tarjetas en cuadrícula. Móvil: tarjetas a una columna con píldora flotante |

**Ventajas.** La más amable y la más fácil de entender de un vistazo: el anillo comunica la humedad sin leer. Se siente moderna y cercana. Las tarjetas se adaptan bien al móvil.
**Desventajas.** **La menos densa**: el Directorio y las tablas del admin ganan menos. **La más cara de implementar y mantener** (anillos con `conic-gradient` y máscaras, degradados, sombras, navegación flotante). El anillo en 0 % y la ausencia de dato exigen cuidado para no confundir `null` con 0 (se resolvió con anillo punteado). La píldora flotante tapa contenido y exige relleno extra. Es la propuesta que más se parece a una «app genérica».

## C · Cartel

**Concepto.** Un cartel: tipografía enorme, reglas negras gruesas y bloques planos de color. Lo importante se lee a un metro de distancia, con el sol de frente, y el estado es un bloque que no se puede ignorar.

| Aspecto | Definición |
|---|---|
| **Paleta (claro)** | Blanco `#ffffff`, tinta `#0a0a0a`, acento cobalto `#1b35f0`. Estados en bloques: lima `#b9f26a`, amarillo `#ffc61a`, gris `#dcdcd6`, coral `#ff6b5b` |
| **Paleta (oscuro)** | Fondo `#0a0a0a`, tinta `#f4f4ee`, cobalto claro `#9aa8ff`; los bloques de estado conservan su color con texto negro |
| **Estado** | Bloque plano con borde negro y texto en mayúsculas; «sin nodo» con **rayado**, «sin datos» en gris: distintos sin depender del color |
| **Tipografía** | Archivo (500–900), una sola familia; títulos en mayúsculas de hasta 68 px y cifras prioritarias de hasta 104 px |
| **Tarjetas, tablas, componentes** | Sin radios ni sombras. Filas con regla de 2 px; encabezado de tabla negro; botones rectangulares con borde; el valor `stale` se **tacha** |
| **Navegación y encabezados** | Barra superior alta con marca en mayúsculas y pestañas de bloque (activa invertida); regla de 6 px bajo ella |
| **Espaciado y jerarquía** | Contraste extremo de tamaños: título, resumen y cifras enormes; el resto pequeño |
| **Escritorio / móvil** | Escritorio: tabla ancha con mapa al lado. Móvil: barra inferior negra a todo el ancho y bloques de cifras apilados |

**Ventajas.** **El mejor contraste y la mejor lectura al sol en el móvil**, el caso de uso de campo. El estado se entiende sin color. La más barata de implementar: sin efectos, sin imágenes. Identidad inconfundible. Cumple los 44 px y WCAG con facilidad.
**Desventajas.** Estridente: puede sentirse agresiva o «poco agrícola» para algunos clientes. Los pesos 900 y las mayúsculas cansan en pantallas con mucho texto (Directorio, formularios largos). Menos densa que A. El rayado y el tachado son marcas fuertes que conviene validar con productores. Más difícil de suavizar si se quiere un tono más cálido.

## Recomendación técnica

**Mi recomendación es C como base, con una advertencia clara.** Se trata de una recomendación mía; la decisión es tuya.

Motivos técnicos, en orden de peso:
1. **El productor usa la app en el campo, con el teléfono al sol.** C es la que mejor responde a eso: contraste máximo, cifras de 44–104 px y estado que no depende del color. A y B quedan por debajo en ese criterio. Es un juicio de diseño, **no una medición al sol**: B depende más de superficies suaves y gradientes, que suelen perder contraste con reflejos.
2. **Costo y riesgo de implementación.** C y A son formas planas con CSS sencillo; B necesita máscaras, conic-gradient y navegación flotante, que son más frágiles entre navegadores y más difíciles de mantener.
3. **Accesibilidad.** Las tres pasan axe sin violaciones (ver abajo), pero C tiene el mayor margen.

**Cuándo elegiría A en su lugar:** si el uso diario más intenso es del **admin** (Directorio, tablas, Red), porque su densidad y su riel lateral rinden más. **Cuándo elegiría B:** solo si se prioriza una primera impresión amable por encima de la densidad y del contraste, y se acepta el costo extra.

**Riesgo de C que conviene mitigar** antes de aprobarla: probarla con 2 o 3 productores reales y, si resulta demasiado fuerte, suavizar los pesos y las mayúsculas en el Directorio y los formularios sin perder los bloques de estado.

## Pruebas

Scripts: `audit/50-variants-shots.mjs`, `audit/41-proto-interact.mjs <carpeta> <variante>` y `audit/43-proto-blankclick.mjs`.

| Prueba | A | B | C |
|---|---|---|---|
| 47 interacciones (cambio de rol, pin → área, presets, métrica, paginación, descarga simulada, formulario, Escape, árbol/volver en móvil, estados vacíos, `null` ≠ 0) | 47/47 | 47/47 | 47/47 |
| axe WCAG 2.1 A/AA en 14 rutas × 4 combinaciones de viewport y tema | 0 | 0 | 0 |
| 4 pantallas × 2 viewports × 2 temas (48 páginas en total): desborde horizontal, errores de consola, controles táctiles < 44 px en móvil | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Clic en zona sin controles no cambia de ruta (regresión del defecto del prototipo original) | OK | OK | OK |

Durante las pruebas axe encontró 4 fallos de contraste en C (valor atenuado sobre el bloque cobalto y aviso «sin datos» en oscuro); **se corrigieron** antes de la cifra de arriba. El fallo de «Red» que apareció en A fue de la prueba (el título lleva un adorno `▍` que cambia su nombre accesible), no de la interfaz.

**Límites de lo probado:** solo Chromium; las fuentes se cargaron desde Google Fonts, y sin red el aspecto cambia; el mapa es ilustrativo; no se probó con lector de pantalla ni con productores reales; las cifras de contraste son de axe, no de una auditoría manual. **El ojo humano no está medido:** las capturas se revisaron una a una solo en parte (las pantallas principales a 1366 y 390 px); conviene que las revises tú en el enlace.

## Qué queda por decidir

1. Elegir A, B o C (o pedir una mezcla concreta, p. ej. «navegación de A con la tipografía de C»).
2. Si hay que ajustar la elegida (tono, pesos, color de acento) antes de la fase 1.
3. Las decisiones pendientes de `../README.md` (clase C, botones del perfil, etc.) siguen vigentes.

Hasta entonces **no se implementa nada**.


## Ronda 2 (A y B, con el mapa como protagonista)

**Dónde:** `variants-2/` (`python3 -m http.server 5199` dentro de la carpeta; **necesita internet** para mapa y fuentes) y su `README.md`.

**Mapa.** Es el de la app real (MapLibre) con capas **Mapa** y **Satélite**, pines con nombre, humedad y estado, pines de **predio** al alejar, chips para ir a cada predio y ventana con «Abrir área». Aparece en Mis predios (grande), Hoy (junto a los pendientes), Área › Ahora y Detalles, y Directorio › Nodo. Las coordenadas de ejemplo caen sobre zona agrícola real (valle de Delicias) para que el satélite muestre cultivos.

| | **A · Levantamiento** | **B · Agua** |
|---|---|---|
| Peso del mapa | Mitad derecha de la pantalla, a altura completa; la lista es una hoja a la izquierda | Encabezado de 460 px a todo el ancho; tarjetas debajo |
| Capa por defecto | Mapa (OpenFreeMap claro, CARTO oscuro) | Satélite |
| Navegación | Riel lateral | Barra superior plana |
| Tipografía | Geist (texto) y Geist Mono (solo cifras) | Bricolage Grotesque (títulos y cifras) e Instrument Sans |
| Acento único | Azul tinta `#1b3a64` | Verde azulado `#0b5d66` |
| Forma | Un solo radio de 4 px, líneas finas, sin cajas decorativas | Tarjetas de 14 px, controles de 10 px, sombra teñida |

**Sobre la sensación «de IA».** Usé la skill `design-taste-frontend`. Ella misma dice que no es para dashboards, así que apliqué solo lo transferible: quitar adornos sin función (marcas `▍` y `>`, cuadrícula de fondo, etiquetas en mayúsculas, anillos de medidor, degradados de fondo, acento lima, píldora flotante), un solo acento por propuesta, un solo sistema de radios, sombras teñidas, tipografías que no son las de siempre y material real (mapa y satélite) en lugar de ilustración dibujada. **Lo que no puedo garantizar** es que ya no se sientan genéricas: eso lo decide tu ojo. Lo más probable es que lo que siga sintiéndose genérico sea la estructura de tarjetas y listas, que se mantuvo para conservar la UX.

**Límites conocidos.**
- **No publiqué la ronda 2 como Artifact:** el visor bloquea las descargas de teselas y solo mostraría la ilustración de respaldo. El mapa real se ve abriendo `variants-2/` en local.
- El satélite es de Esri con su atribución; para producción hay que revisar sus términos o elegir otro proveedor.
- En móvil quedan 2 o 3 controles del mapa (zoom/atribución) justo por debajo de 44 px en la propuesta A; no se corrigió.
- Pruebas hechas: 54 de 54 interacciones en A y en B (incluido el respaldo sin mapa), 32 capturas, 0 violaciones de axe, 0 desbordes. Sin pruebas con usuarios.

## Qué queda por decidir
Elegir A o B (o una mezcla) y decir si el mapa tiene el peso que buscabas o hay que subirlo o bajarlo en alguna pantalla.
