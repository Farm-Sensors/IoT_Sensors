# Decisiones de Arquitectura (ADRs)

Formato ligero: contexto → decisión → consecuencias. Las decisiones de **producto** (por qué existe el sistema) viven en `docs/product/solution-exploration.md`; aquí están las decisiones técnicas de construcción.

## ADR-001 — Lecturas en wide table única

- **Estado:** Aceptado (migración `7a66ef728239`, que unificó `lecturas_suelo/riego/ambiental`).
- **Contexto:** El diseño inicial normalizaba cada lectura en 3 subtablas por categoría.
- **Decisión:** Una sola tabla `lecturas` con los 12 campos dinámicos, indexada por `(nodo_id, marca_tiempo)`.
- **Consecuencias:** Ingesta y consultas por rango más simples (un INSERT por lectura); sin JOINs por categoría. El volumen (144 lecturas/día/nodo) se maneja con índices; particionamiento se evalúa en Fase 2.

## ADR-002 — Orquestación backend-first, sin n8n

- **Estado:** Aceptado (decisión de producto confirmada).
- **Contexto:** Fase 2 (reportes IA, notificaciones) podía orquestarse con n8n.
- **Decisión:** Schedulers internos de Python (`app/jobs/`) que llaman a la API con credenciales admin; n8n fuera de alcance.
- **Consecuencias:** Menos servicios que operar, una sola fuente de lógica; los schedulers son contenedores aparte en compose (profile `phase2`).

## ADR-003 — Azure OpenAI con fallback determinístico

- **Estado:** Aceptado.
- **Contexto:** El asistente IA y los reportes dependen de Azure OpenAI, sin credenciales en desarrollo.
- **Decisión:** Si `AZURE_OPENAI_ENABLED=false` o Azure falla, se genera una respuesta/reporte **determinístico basado en reglas**; el flujo operativo nunca se rompe.
- **Consecuencias:** La UI y los tests funcionan sin Azure; la calidad de IA real depende de configurar credenciales.

## ADR-004 — Fase 2 dormida detrás de flags (descafetizar)

- **Estado:** Aceptado (cambio `descafetizar-fase-2`).
- **Contexto:** IA, umbrales/alertas, notificaciones y schedulers ya estaban implementados y activos, contradiciendo el alcance del MVP.
- **Decisión:** Flags OFF por defecto (`ALERTS_ENABLED`, `AI_ASSISTANT_ENABLED`, `AI_REPORTS_ENABLED`, `NOTIFICATIONS_ENABLED`); schedulers en profile `phase2`; endpoints de IA responden 503 apagados.
- **Consecuencias:** El MVP corre como Fase 1 pura (ingesta + visualización + histórico); activar Fase 2 = env flags + `--profile phase2`. El código queda listo, no borrado.

## ADR-005 — Stack UI: shadcn/ui + Radix + Tailwind v4 (MUI retirado)

- **Estado:** Aceptado (cambio `remove-unused-ui-deps`).
- **Contexto:** El frontend declaraba MUI + Emotion + popper/slick/dnd sin ningún uso real (residuos del template).
- **Decisión:** Conservar shadcn/ui (Radix) + Tailwind v4 + lucide + recharts + maplibre; eliminar 10 dependencias muertas; fijar `@types/react@^18` (runtime React 18).
- **Consecuencias:** 47 dependencias; bundle más liviano; un solo lenguaje visual.

## ADR-006 — Especificación con OpenSpec (SDD) y docs en 3 capas

- **Estado:** Aceptado.
- **Contexto:** La documentación crecía sin estructura; el código adelantaba a los docs.
- **Decisión:** OpenSpec para comportamiento (specs + cambios por feature), `docs/product/` para negocio y `docs/` para referencia técnica; CI gatea regresiones.
- **Consecuencias:** Todo cambio de comportamiento parte de un cambio OpenSpec; las specs son la fuente de verdad del "qué".

## ADR-007 — Auth: JWT con refresh persistido + API keys fijas por nodo

- **Estado:** Aceptado (con pendientes conocidos).
- **Contexto:** Dos tipos de actores: usuarios web y nodos IoT.
- **Decisión:** Usuarios: JWT access (30 min) + refresh token persistido en BD (revocado en logout/cambio de contraseña), roles `admin`/`cliente` con ownership server-side. Máquinas: credencial de gateway por predio (`X-API-Key` hasheada) + `X-Logical-Node-Id`. Las API keys por nodo quedan obsoletas para autenticación.
- **Consecuencias:** Pendientes conocidos: el refresh no tiene rotación ni detección de reuso; las API keys se almacenan en texto plano en BD (hash pendiente).

## ADR-008 — Mapas con MapLibre GL + OpenFreeMap

- **Estado:** Aceptado.
- **Contexto:** Visualización geoespacial de nodos (GPS estático) sin costo por nodo.
- **Decisión:** MapLibre GL JS con estilo base OpenFreeMap (`https://tiles.openfreemap.org/styles/liberty`), configurable por `VITE_MAP_STYLE_URL`.
- **Consecuencias:** Cero costo de tiles; se puede migrar a un proveedor con SLA sin reescribir la UI.