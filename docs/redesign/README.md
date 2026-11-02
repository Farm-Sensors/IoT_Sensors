# Rediseño v2 — punto de entrada

Lee este archivo primero. Debe bastar para continuar sin el historial de la conversación.

## Objetivo

Reconstruir la experiencia de IoT_Sensors desde las tareas del usuario: navegación, arquitectura de información y flujos. **No** cambia la lógica de negocio, la API ni la base de datos. Debe sentirse como una aplicación nueva, no como la anterior con mejores tarjetas.

## Estado al cerrar la preparación (2026-10-31)

| Trabajo | Estado |
|---|---|
| Propuesta de arquitectura, flujos y dirección visual | **Hecha**, dirección aceptada y **validada** con auditoría y prototipo |
| Auditoría real con Playwright | **Hecha** (`v2/01-auditoria.md`, evidencia en `v2/audit/`), con base de datos aislada |
| Inventario de flujos y de paridad funcional | **Completos y medidos** (`v2/03-flujos.md`, `v2/04-paridad.md`) |
| Prototipo navegable | **Construido y probado** (`v2/prototype/`); enlace privado abajo |
| Identidad visual | **Elegida: A (Levantamiento)**; prototipo final en `v2/prototype-a/` |
| Implementación de v2 | **Hecha** (7 fases, 2026-11-01) con la identidad provisional «Sensores Agrícolas»; en revisión en el PR #71 |

## Propuestas visuales (pendientes de elegir)

**Decisión tomada (2026-11-01): propuesta A · Levantamiento.** Versión final en `v2/prototype-a/`; la portada es un **resumen con gráficas** y el **mapa es una página aparte**. Rondas anteriores en `v2/variants-2/` (A y B con mapa) y `v2/variants/` (A, B, C). Comparativa, definiciones y recomendación técnica: `v2/10-propuestas-visuales.md`. Navegables en `v2/variants/` o en https://claude.ai/artifact/Gf8DpTSJZtcMHRocGJWkiC (privado). **El usuario decide.**

## Prototipo

- **Carpeta:** `docs/redesign/v2/prototype/` (`python3 -m http.server 5199` dentro de la carpeta).
- **Enlace privado:** https://claude.ai/artifact/YWgz8cJeaa6GFL9dCSGNdC (solo el dueño; compartirlo se hace desde su menú «Compartir»).
- Pantallas: Mis predios, Área (Ahora, Historial, Detalles), Cuenta, Hoy, Directorio, y maquetas mínimas de Red y Ajustes. Escritorio y móvil, claro y oscuro. Formularios y descargas simulados.
- Pruebas: 60 rutas sin desbordes ni errores, 47 de 47 interacciones, axe 0 violaciones, 0 objetivos táctiles < 44 px.

## Hallazgos principales de la auditoría (de `main`, medidos)

1. La portada del productor muestra **una** área, elegida con dos selectores, y el área **no tiene dirección** (una sesión nueva abre otra distinta).
2. Alta completa del admin: **31 acciones en 6 pantallas** y el paso de Ciclos exige **escribir la URL** (`/admin/ciclos` no tiene enlace).
3. La barra móvil **oculta destinos** (productor: Perfil, Tema y Salir; admin: Catálogo, Auditoría, Tema y Salir) y la lista de clientes corta la mitad de sus acciones a 768 px.
4. El panel del admin no lista problemas; sus atajos «Nuevo Cliente» y «Nuevo Nodo» solo navegan.
5. «Ver Planes» y «Cambiar Contraseña» no tienen función; «Plan Profesional» es texto fijo.
6. Un área sin comunicación muestra sus valores igual que una al día. El admin no puede ver lo que ve un cliente.
7. Las rutas de Fase 2 siguen alcanzables por URL con el módulo apagado (algunas con 503); se conserva el gate.

Lista completa (21 hallazgos): `v2/01-auditoria.md`.

## Qué sigue, en este orden

1. **El usuario autoriza empezar la implementación** (fase 1 de `v2/09-fases.md`, con la identidad A) y decide lo pendiente (abajo).
3. Implementar por fases (`v2/09-fases.md`), una revisión del usuario al final de cada una.
4. En cada fase: pruebas (`npm test -- --run`, `npm run typecheck`, `npm run build`, `npx playwright test`), axe en claro **y** oscuro, revisar capturas a 390 y 1366 px, y comparar peticiones con `main`.

## Decisiones que necesitan al usuario

| # | Decisión | Recomendación |
|---|---|---|
| 0 | ~~Elegir la identidad visual~~ | **Resuelta**: A |
| 2 | Pantalla para que el admin vea lo que ve un cliente (`AGENTS.md` §3, clase C) | Autorizar una vista de solo lectura que reutilice «Área»; el requisito ya está documentado |
| 3 | «Ver Planes», «Plan Profesional», «Cambiar Contraseña» | Ocultarlos hasta definirlos; hoy engañan |
| 4 | ¿El productor ve «Equipo pendiente»? (las 4 áreas DEMO lo muestran, y es correcto) | Mostrarlo solo al admin |
| 5 | Acentos de `utils/datetime.ts` («Hace 1 dia») y «SIN COMUNICACION» | Autorizar la corrección: es una cadena |
| 6 | Revisión con Alan: ¿un PR por fase? | Un solo PR con un commit por etapa (PR #71); las capturas pesadas quedan fuera del repo |
| 7 | ~~Aprobar la identidad visual del prototipo original~~ | **Sustituida** por la decisión 0: el usuario no aprobó esa estética |
| 8 | **Nuevo:** «Red» y «Ajustes» están como maqueta mínima en el prototipo; ¿se quiere un prototipo completo de esas dos antes de implementar? | No es necesario: su lógica no cambia, solo su marco |

## Decisiones aprobadas

- **Identidad visual nueva**, en lugar de la crema, olivo y Playfair anteriores.
- **Móvil y escritorio al mismo nivel.**
- La dirección de navegación y arquitectura de `v2/02-arquitectura.md` es adecuada.
- Separar navegación de funcionalidad nueva. **Excluidas:** búsqueda global, compartir áreas y anterior/siguiente entre áreas.
- La auditoría usa base aislada o copia.
- El prototipo debe ser navegable e interactivo, no maquetas estáticas.
- Sin commits, push, reversiones ni implementación sin autorización explícita.

## Documentos

| Archivo | Contenido |
|---|---|
| `v2/01-auditoria.md` | Auditoría ejecutada: método, 21 hallazgos, evidencia y cómo repetirla |
| `v2/02-arquitectura.md` | Arquitectura, navegación, pantallas, clases de cambio y validación |
| `v2/03-flujos.md` | Flujos medidos en `main` y pasos en v2 |
| `v2/04-paridad.md` | Cada función (productor, admin, Fase 2) con su destino y verificación |
| `v2/05-prototipo-y-visual.md` | Especificación visual, prototipo construido y pruebas |
| `v2/07-componentes.md` | Conservar, reemplazar, crear |
| `v2/08-restricciones.md` | Reglas que no se pueden romper |
| `v2/09-fases.md` | Fases y criterios de aceptación |
| `v2/10-propuestas-visuales.md` | Las tres propuestas visuales, comparativa y recomendación |
| `v2/prototype/` | El prototipo original (con su `README.md`) |
| `v2/variants/` | Ronda 1: A, B y C (con su `README.md`) |
| `v2/variants-2/` | Ronda 2: A y B con mapa real (con su `README.md`) |
| `v2/prototype-a/` | **Prototipo final con la identidad A** (referencia visual de la implementación) |
| `v2/audit/` | Scripts, resultados y capturas de la auditoría |

## Avisos para el modelo siguiente

- Lee `AGENTS.md`: Fase 2 bloqueada, vocabulario y documentación obligatoria.
- No reportes cifras sin medirlas: se corrigieron «13 acciones» (real: 31) y «a 768 px ninguna acción se ve» (real: la mitad).
- Mira las capturas además de las pruebas: en el prototipo, una medición táctil encontró 66 controles por debajo de 44 px que las pruebas funcionales no detectaban.
- El suite a11y de la app solo mide tema claro.
- La auditoría usó una **copia** de la base: no hay que tocar `sensores_mysql`. Recreación en `v2/01-auditoria.md`.
- Engram no estaba disponible: el contexto vive aquí y en la memoria de archivos.


## Identidad provisional «Sensores Agrícolas» (2026-11-01)

Se aplicó el paquete de marca (`docs/brand/`) sobre la UX aprobada: tokens verdes, Plus Jakarta Sans alojada en el repo, logo y favicon. Solo presentación; detalle en `design-system.md`. El nombre y la identidad son provisionales. La paleta azul «Levantamiento» queda reemplazada en la app (el prototipo `v2/prototype-a/` conserva la suya como referencia histórica).
