# Evaluación de riesgos

## 1. Riesgos por tipo

| # | Riesgo | Prob. | Impacto | Medida |
|---|---|---|---|---|
| R1 | Un cambio de presentación altera un valor, un cálculo o un `null` mostrado como `0` | Media | **Alto** | Pruebas que comparan el valor mostrado con la API; `null` → «Sin datos» con prueba; revisión de que `utils/`, `services/` y `types/` no aparezcan en el diff (`git diff --stat`) |
| R2 | Las llamadas `api.*` de páginas (16 archivos) cambian al extraer componentes | Media | Alto | Comparar en Playwright la lista de peticiones (método, URL, parámetros) antes y después de cada etapa; extraer solo JSX |
| R3 | Romper el emparejamiento de equipos | Baja | **Alto** | `/pair` y `/admin/gateways/pair` quedan fuera del rediseño; `equipos.spec.ts` obligatorio |
| R4 | Perder acceso a una función al reordenar menús o agrupar acciones | Media | Alto | Inventario de rutas y acciones por fila antes/después; ninguna ruta se elimina; «Predios» del cliente queda accesible en cada etapa |
| R5 | Tocar Fase 2 por efecto secundario (alertas, IA, umbrales, notificaciones) | Baja | Alto | Gates de `items.ts` y `useModules` intactos; no se encienden flags; las páginas de Fase 2 solo cambian por componentes compartidos |
| R6 | Las e2e fijan etiquetas y rompen | **Alta** | Medio | Actualizar el selector en el mismo cambio que la etiqueta (regla §5) |
| R7 | El baseline a11y sube | Media | Medio | Medir por página tocada; el suite hoy **no mide 3 páginas** (ver 3) |
| R8 | Pérdida de enlaces guardados por el cliente (`/cliente/exportar`) | Media | Bajo | Redirección, no eliminación |
| R9 | Atenuar tarjetas prioritarias reduce su prominencia (`AGENTS.md` §2.2) | Media | Alto | Atenuar el contraste de fondo, no el tamaño ni la posición; revisión visual explícita |
| R10 | Rama grande difícil de revisar para Alan | **Alta** | Medio | Una etapa = un PR dependiente, probada; no fusionar etapas |

## 2. Funcionalidades que podrían verse afectadas

Exportación (CSV, Excel, PDF) por mover su entrada; selección de predio/área y su persistencia (`persistenceKey` `client`/`admin`); jerarquía admin Clientes → Predios → Áreas; alta de equipos; menú y tema; panel admin con su sondeo de 3 s.

## 3. Medidas para preservar la lógica de negocio

- **Frontera dura:** no se editan `frontend/src/app/services/`, `types/`, `utils/` ni el backend. Cualquier diff en esas rutas detiene la etapa.
- **Frescura:** se lee el resultado del cálculo existente; no se reimplementa ni se cambia `FRESH_MINUTES_THRESHOLD`.
- **Datos:** `null` nunca se muestra como `0`; unidades fijas; las 12 variables y sus 3 categorías.
- **Permisos:** `ProtectedRoute` y los roles no se tocan.
- **Equivalencia observable:** antes de cada etapa se guardan peticiones y capturas; después se comparan.

## 4. Decisiones que no son mías

1. **Rutas.** `docs/ui-redesign-rules.md` §2 prohíbe cambiar rutas; este encargo lo permite. No se elimina ni renombra ninguna; solo `/cliente/exportar` pasa a redirigir y se usan parámetros de consulta nuevos. Hay que reflejarlo en esas reglas (etapa 0).
2. **Rama única.** `AGENTS.md` y `docs/team-ronda-1.md` piden ramas `feat/<issue>-…`, un PR por issue y que Alan revise y fusione. Esta rama sigue el encargo (`redesign/ux-ui-overhaul`); la implementación debería partirse en un PR por etapa y acordar con Alan el orden de revisión.
3. **Fase 2 bloqueada.** Las páginas de alertas, umbrales y notificaciones abren por URL con el módulo apagado (N7), y el panel admin enlaza «Configurar Umbrales» y «Ver Auditoría» sin gate. Cambiarlo exige autorización del dueño de la integración; este plan **no lo toca**.
4. **Marca y etiquetas.** Conservar crema + olivo + Playfair y cambiar a propósito las etiquetas del menú («Dashboard» → «Inicio», «Predios» y «Exportar» fuera del menú) son decisiones de producto que `design-taste-frontend` §11.F pide no tomar en silencio; ver `design-proposal.md`, «Decisiones del dueño».
5. **Memoria.** `AGENTS.md` pide guardar en Engram; esta sesión no tiene esa herramienta. La memoria de archivos del proyecto lo cubre parcialmente (ver cierre de la sesión).

## 5. Dudas abiertas

- ¿Se usa `/cliente/predio/:id`? Hoy ninguna pantalla enlaza a ella; no sé si es una vista útil sin acceso o código muerto. Se propone enlazarla desde el selector; si el dueño prefiere retirarla, se decide aparte.
- El pulso `rippleExpand` es la causa confirmada en `/cliente/areas` y `/admin/nodos/:id`. En `/cliente` no pude reproducirlo (su área estaba desactualizada); queda por comprobar con un área fresca.
- ¿Quién necesita «Equipo pendiente» en las tarjetas del cliente? Lo veo como estado de infraestructura expuesto al cliente; no sé si es intencional.
- «Rancho» (Equipos) frente a «Predio»: no lo corrijo (regla de nombres).
- Los datos de la base local son de demostración; el comportamiento con volumen real (decenas de predios) no se probó.
- No inspeccioné las capturas de 768 px salvo Clientes; el diagnóstico de ese ancho está reforzado solo en esa pantalla.
- El mapa se capturó con WebGL por software.

## 6. Limitaciones de esta auditoría

- Conteos de acciones derivados de la estructura, no cronometrados con usuarios.
- Fase 2: solo se observó su estado visible con los módulos apagados.
- No creé, edité ni borré entidades en la base local (solo inicios de sesión y aperturas de diálogos sin guardar); no hay datos `UX-AUDIT` que limpiar.
- El suite a11y no pudo medir tres páginas (ver `ux-audit.md`), así que no hay veredicto AA para ellas.
