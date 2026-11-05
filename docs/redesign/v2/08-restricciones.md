# Restricciones

Vigentes en toda etapa. Si un cambio las necesita romper, detente y pregunta.

## Autorización

- Sin commits, push, reversiones ni descarte de cambios sin autorización explícita.
- Sin implementar hasta aprobar auditoría, prototipo e inventarios.
- Trabajar solo en `redesign/ux-ui-overhaul`, nunca en `main`.
- Commits y PR del usuario: **sin** `Co-Authored-By` ni «Generated with Claude Code» (preferencia guardada en memoria).

## Lógica de negocio

- Sin cambios en `backend/`, `services/`, `types/`, `utils/`, ni en reglas, cálculos, validaciones, integraciones o datos.
- Sin endpoints nuevos ni cambios de parámetros. Reutilizar las llamadas existentes; sin cambiar intervalos de sondeo (panel 3 s, dashboard 30 s, mapa 30 s, asistente 15 s).
- Ninguna función existente puede desaparecer: `04-paridad.md` manda.
- Funcionalidad nueva solo con autorización (`02-arquitectura.md`, clases C y D).

## Reglas del dominio (`AGENTS.md`)

- `null` nunca se muestra como `0`; un cero medido sigue siendo `0`. No copiar `humidity ?? 0` de `AreaCard`.
- Prioridad visual: humedad, flujo, E.T.O.
- Frescura visible por área: último dato y tiempo transcurrido. Umbral `FRESH_MINUTES_THRESHOLD` = 20 min.
- Unidades fijas; 12 campos en Suelo, Riego y Ambiental. NDVI nunca es telemetría.
- Permisos por rol sin cambios; el cliente solo ve lo suyo.
- «Atención» es problema de datos, nunca recomendación de riego.

## Fase 2

**Bloqueada.** No encender flags ni el perfil `phase2`, ni expandir sus pantallas. Conservan rutas y gate. Solo `OPEN_METEO_ENABLED` está permitido, y el NDVI de último punto. «Configurar Umbrales», «Ver Auditoría», «¿Olvidé mi contraseña?» y la entrada de Auditoría se conservan.

## Contratos

`/pair`, su `?code=` y `/admin/gateways/pair` no cambian.

## Vocabulario

Predio, Área de riego, Nodo, Equipo, Cliente, Ciclo de cultivo, Catálogo. Nunca «gateway», «parcela», «slot» ni «payload» en pantalla. «Rancho» en Equipos es una incoherencia conocida: renombrarlo requiere decisión.

## Calidad

- WCAG 2.1 AA en claro y oscuro; foco visible; objetivos de 44 px en móvil; estado nunca solo por color.
- Sin dependencias nuevas sin justificarlas.
- Documentar todo cambio (`AGENTS.md`): `docs/system.md`, `docs/architecture/frontend.md`, `docs/design-system.md`, `docs/ui-redesign-rules.md` y specs de OpenSpec.
- `make dev` para el stack. Datos de prueba solo en base aislada.
