# Propuesta de dirección visual

Revisada con `design-taste-frontend` y `frontend-design`. Esta versión sustituye a la primera, que no las había usado.

## Qué aplica de cada skill y qué no

- **`design-taste-frontend`** declara fuera de su alcance los dashboards, las tablas y los formularios de varios pasos (§13), que es esta aplicación. Por eso **no** aplico sus reglas de landing (hero, eyebrows, bento, marquesinas, imágenes, logos). Sí aplico las transferibles: protocolo de rediseño (§11), bloqueos de color y de forma (§4.2, §4.4), contraste de botones y formularios, estados, movimiento motivado y `prefers-reduced-motion` (§5, §6.B), modo oscuro (§8) y auditoría del texto.
- **`frontend-design`**: plan de tokens, crítica contra los valores por defecto y cambios. Está abajo.

Lectura del encargo: *herramienta operativa para productores y para el administrador, con lenguaje sobrio, en rediseño que conserva la marca.* Diales: variación **3**, movimiento **2**, densidad **6** (admin) y **4** (cliente, más espacio porque se consulta en campo).

## Plan de tokens

| Elemento | Decisión |
|---|---|
| **Color** (existentes, sin cambio) | Crema `#F4F1EB` (página) · Hueso `#F9F8F4` (superficie) · Olivo `#5A6B4C` (acento único; `#8CA478` en oscuro) · Tinta `#2C2621` (texto) · estados ámbar/rojo/verde ya definidos |
| **Tipografía** | Playfair Display solo en `h1` y el saludo; Inter 600 para `h2`-`h4`, títulos de tarjeta y encabezados de tabla; JetBrains Mono solo en valores numéricos |
| **Forma** | Regla de tres radios (abajo) |
| **Capas** | Superficies sólidas; el vidrio (`glass-*`) sale de la navegación y de los contenedores de datos |
| **Movimiento** | Solo el que responde a una acción o comunica un cambio de estado |

## Crítica contra los valores por defecto (y qué cambié)

1. **Paleta crema + serif.** `#F4F1EB` con Playfair es justo el grupo que `frontend-design` marca como «valor por defecto de IA». No la cambio: es la identidad documentada del producto (`design-system.md` §1), ya está medida para AA, y el encargo es mejorar claridad, no rebautizar la marca. **La dejo como decisión del dueño** (sección final) y evito extenderla: nada de más dorados ni decoración cálida.
2. **Serif en cada título de tarjeta.** Es el hallazgo que sí cambia. Hoy una tarjeta mezcla tres familias (serif en el título, sans en el cuerpo, mono en el dato). El serif a 18 px compite con el dato prioritario. Cambio: serif solo en el título de página; el resto, sans.
3. **Tarjeta para todo.** Cada bloque va en una tarjeta de 32 px, incluidas las tablas. Con densidad 6, las tablas del admin pasan a **superficie plana con `divide-y`**, sin tarjeta alrededor. Las tarjetas se reservan para lo que merece elevación: las métricas prioritarias y los bloques accionables.
4. **Tres tarjetas iguales para las métricas.** Humedad, flujo y E.T.O. comparten tamaño aunque `AGENTS.md` §2.2 las ordena 1, 2, 3 y llama a la humedad «indicador principal». Cambio: la humedad ocupa el doble de ancho y las otras dos se apilan a su lado. Además elimina el hueco vacío bajo «Flujo de Agua» y «E.T.O.» (U8).
5. **Entradas y fondos animados.** Ver «Movimiento»: es el cambio de mayor efecto, y además arregla un fallo de accesibilidad real.
6. **Texto de relleno.** Se retiran etiquetas que no informan: «Contexto activo» sobre el selector, los títulos numerados «1. Elige qué datos / 2. Descarga» (no son una secuencia real una vez unido Exportar a Histórico), y el punto sin etiqueta de «Estado del Riego».

Lo que dejo igual porque el diseño ya acierta: acento único (olivo), estados con icono y texto, objetivos de foco visibles, `null` → «Sin datos», valores en mono tabular.

## Movimiento

**Hallazgo (medido):** `FreshnessIndicator` lanza un pulso infinito (`rippleExpand 2s infinite`) en cada punto de dato fresco. En el navegador, `/cliente/areas` tenía 4 animaciones en curso y `/admin/nodos/1` y `/admin/nodos/2` una cada una. Es la causa de que el test a11y no pueda medir esas páginas (`document.getAnimations()` nunca termina). `/cliente` no la mostró en mi medición porque su área estaba desactualizada; con un área fresca la tendría. Hay un segundo pulso en el punto de «Estado del Riego» cuando riega. El CSS no contiene ningún `prefers-reduced-motion`.

| Hoy | Propuesta | Motivo |
|---|---|---|
| Punto con pulso infinito en la frescura y en el riego | Punto estático; el texto («Datos actuales», «Regando») ya dice el estado | El pulso no aporta información y bloquea la medición; WCAG 2.2.2 pide poder pausar el movimiento que dura más de 5 s |
| Tres orbes difuminados que flotan de fondo (modo oscuro) y manchas fijas (claro) en toda la app | Fondo sólido | Decoración sin función; capas con desenfoque de 110-160 px a pantalla completa cuestan GPU en móviles |
| `PageTransition`: aparece con 0,4 s subiendo en 30 de las 32 páginas, más escalonado por tarjeta | Solo opacidad, 150 ms, y solo al cambiar de ruta | Movimiento que no comunica nada |
| Tres puntos que rebotan en `ProtectedRoute` | Esqueleto o texto «Cargando» | Patrón genérico |
| Sin `prefers-reduced-motion` | Un bloque global que desactiva animaciones y transiciones | Requisito de accesibilidad |

Se conservan los spinners de botón (confirman una acción) y los esqueletos de carga.

## Forma

Hoy conviven radios de 32, 24 y 16 px más «píldora» (visto en `AdminDashboard`, `ExportData`, `SelectionScopeBar`, `BentoCard`). Regla única, documentada en `design-system.md`:

- **32 px** solo contenedores de primer nivel (tarjeta de métrica, tarjeta accionable).
- **16 px** controles y bloques internos (campos, selectores, menús, filas, diálogos).
- **Píldora** solo botones y chips.

## Esqueleto de pantalla

```
┌ h1 · selector de contexto (Predio › Área ▾) · acción principal ┐
├ barra de herramientas: búsqueda · filtros                       ┤
├ contenido                                                       ┤
└ (móvil) barra inferior de 4 pestañas                            ┘
```

Dashboard del cliente, escritorio:

```
┌ Hola, Alan                         [Granja Hogar › Área ▾] ┐
│ Sin comunicación desde hace 45 h · último dato 29/10 9:00 p. m. │
├──────────────────────────────┬─────────────────────┤
│ Humedad del suelo            │ Flujo de agua       │
│ 62.85 %      (anillo)        │ 0 L/min             │
│                              ├─────────────────────┤
│                              │ E.T.O.              │
│                              │ 0.436 mm/día        │
├──────────────────────────────┴─────────────────────┤
│ Suelo · Ambiental · Riego: listas planas, sin tarjeta cada una │
└────────────────────────────────────────────────────┘
```

Alineación a la izquierda en todo. En móvil las tres métricas se apilan en el orden 1-2-3.

## Cambios por componente

| Componente | Hoy | Propuesta | Por qué |
|---|---|---|---|
| Navegación móvil | Carrusel de 8-9 ítems | 4 pestañas + «Más» | N1 |
| Barra lateral admin | 7 ítems planos | Tres grupos con rótulo | Agrupa por tarea; incluye «Ciclos» (N2) |
| Menú de usuario | Perfil, tema y salir sueltos | **Móvil:** dentro de la hoja «Más»/«Cuenta». **Escritorio:** sin cambio (un menú de avatar añadiría un clic a «Cerrar sesión» sin liberar nada) | N1 |
| Navegación y tarjetas | Vidrio con desenfoque: `glass-sidebar` en las dos barras y `glass-card` en `BentoCard` (3 archivos) | Superficie sólida | El texto de navegación se lee sobre contenido que se desplaza; el vidrio solo se justifica sin datos debajo |
| Tablas admin | Tarjeta con 5 botones por fila | Superficie plana, una acción principal + «⋯», tarjetas bajo 768 px | U1, N3 |
| Totales del admin | 4 tarjetas altas | Franja compacta, cada total enlaza a su lista | U3 |
| Filtros del histórico | 700 px de panel | Barra de 1-2 filas; resumen solo si difiere del valor por defecto | O3 |
| Métricas prioritarias | Tres iguales, oscuras en claro | Humedad doble; énfasis por tamaño y un borde de acento, no por fondo; atenuadas si el dato no es fresco | U5, U8, U11 |
| Variantes de `BentoCard` | `sand`, `light`, oscura sin regla | **Dos**: métrica y agrupación. Los avisos son banners en línea, no tarjetas | Tarjeta solo con jerarquía real |
| Frescura | Dos mensajes y dos formatos | Una línea: estado + «hace X» | C1 |
| Estado del riego | Punto sin etiqueta | Insignia con icono y texto (ya existe) | Estado nunca solo por color |
| Insignias de estado | Mayúsculas sin tilde («SIN COMUNICACION») | Sentence case con tilde: «Sin comunicación» | Texto en mayúsculas sostenidas cuesta leer y se escribió mal |
| Formato de fecha del ciclo | «2026-10-01 — Sin fecha de fin» en el selector, «30 de septiembre de 2026 - Actual» en Ciclos, `25/10/2026` en filtros | Un solo formato `dd/mm/aaaa` y «Sin fecha de fin» | Tres formatos para el mismo dato |

## Texto de la interfaz

Reglas de `frontend-design` que aplican: verbos activos, una acción conserva su nombre en todo el flujo, vacíos que dicen qué hacer, errores que dicen qué falló. Dos cambios concretos: «Dashboard» → «Inicio» en todos los anchos; los botones de descarga conservan «Descargar CSV/Excel/PDF» (los fija una prueba e2e). No se renombran entidades (`docs/ui-redesign-rules.md` §3).

## Responsive

**< 768** móvil (pestañas, tarjetas en vez de tablas) · **768-1023** tableta (barra lateral plegada a iconos por defecto) · **≥ 1024** escritorio. Hoy 768 usa el diseño de escritorio completo y es el ancho más dañado.

## Qué evito

Colores nuevos, imágenes, ilustraciones, glassmorfismo en datos, animaciones decorativas, tipografías nuevas, bibliotecas de componentes o iconos nuevos. Se mantiene `lucide-react`, que el proyecto ya usa (`design-taste-frontend` prefiere otras familias, pero `AGENTS.md` y las reglas del rediseño prohíben dependencias nuevas).

## Decisiones del dueño del producto

1. **Marca.** Conservar crema + olivo + Playfair (recomendado: es la identidad y está medida) o abrir una exploración de marca aparte. No es una mejora de UX y no la tomo yo.
2. **Fuentes.** `fonts.css` las carga de Google Fonts con `@import`: bloquea el render y exige conexión. Autoalojarlas es mejor en campo, pero implica añadir archivos de fuente al repositorio.
3. **Etiquetas del menú.** `design-taste-frontend` §11.F pide no cambiar en silencio las etiquetas de navegación. Aquí se cambian a propósito («Dashboard» → «Inicio», «Predios» y «Exportar» salen del menú); requiere tu visto bueno explícito.
