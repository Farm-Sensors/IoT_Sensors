# Auditoría de la experiencia actual (`main`, `af67be8`)

> **Estado: EJECUTADA el 2026-10-31.** Todo lo de este documento se midió navegando la app con Playwright, salvo lo marcado «código» o «no comprobado». Scripts, resultados y capturas: `v2/audit/` (ver [Evidencia](#evidencia-y-cómo-repetirla)).

## Cómo se hizo

| Aspecto | Valor |
|---|---|
| Código auditado | `git archive af67be8 frontend` en una carpeta temporal (no el árbol de trabajo). El backend es idéntico en `main` y en el árbol (`git diff af67be8 -- backend` vacío) |
| Base de datos | **Copia aislada.** `mysqldump` de solo lectura de `sensores_mysql` a un MySQL 8 efímero en `127.0.0.1:3307` (contenedor `audit_mysql`, sin volumen). Verificado: 28 086 lecturas en ambas |
| Servicios | Backend `:5051` (variables de entorno propias, sin tocar `backend/.env`) y Vite `:5174` apuntando a él. El stack del usuario (`:3306`, `:5050`, `:5173`) no se tocó |
| Fase 2 | Apagada. Ningún flag ni perfil se encendió |
| Viewports | 1366×900 (escritorio) y 390×844 (móvil, táctil), con `reducedMotion` |
| Roles | Productor (`cliente`) y admin |
| Datos | 2 clientes, 3 predios, 6 áreas, 6 nodos, 1 ciclo. Áreas al día, sin comunicación (49 h) y sin nodo GPS |

**Límites de lo medido** (para no sobrestimar la auditoría):
- Las **altas** del admin se ejecutaron de verdad, pero en la copia (ya con datos de prueba añadidos: «Empresa Auditoria …»).
- El **emparejamiento de un equipo** no se completó: hace falta un código de dispositivo de la Raspberry. Solo se abrió el asistente (paso 1 de 3) y la pantalla `/admin/gateways/pair`. Lo cubre `frontend/e2e/equipos.spec.ts`, que **no** se ejecutó aquí (su `global-setup` apunta a `:5173`).
- **Modo oscuro de `main` no se auditó.** Solo se midió claro; recordar que el suite a11y también mide solo claro.
- Los datos de la copia envejecen: las áreas «al día» pasan a «sin comunicación» a los 20 min. Es parte de la prueba, pero las capturas muestran la hora en que se tomaron.

## Hallazgos confirmados

| # | Hallazgo | Evidencia medida | Consecuencia |
|---|---|---|---|
| 1 | La portada del productor muestra **una** área, elegida con dos selectores | `/cliente` no tiene enlaces ni botones en `main`, solo 2 `<select>` | «¿Cómo está todo?» no tiene respuesta en la portada |
| 2 | El área **no tiene dirección** | Tras elegir otra área la URL sigue siendo `/cliente`. En una sesión nueva con esa URL se abrió otra área distinta (la guardada en el navegador) | No se puede volver directo ni compartir un área |
| 3 | Dos caminos para lo mismo | Histórico tiene CSV, Excel y PDF; Exportar es otra página con los mismos filtros y formatos | Navegación y selectores repetidos |
| 4 | La barra móvil **oculta destinos** | Productor: Perfil, Tema y Salir fuera de pantalla (x = 338, 398, 458 de 390 px). Admin: Catálogo, Auditoría, Tema y Salir fuera (x = 328, 400, 472, 532) | Destinos invisibles sin deslizar |
| 5 | `/admin/ciclos` **sin enlace** | 0 enlaces «Ciclos» en el menú tras crear el área; solo se llega por URL | Parte del alta es inalcanzable desde la interfaz |
| 6 | El admin **no puede ver lo que ve un cliente** | `/cliente` como admin redirige a `/admin` | `AGENTS.md` §3 sin pantalla (clase C) |
| 7 | El panel del admin muestra totales, no pendientes | El texto del panel no menciona las áreas sin comunicación ni las sin ciclo ni el equipo pendiente; solo «Nodos Deshabilitados: 0» | Hay que ir a buscar los problemas |
| 8 | Los atajos del panel solo navegan | «Nuevo Cliente» y «Nuevo Nodo» llevan a `/admin/clientes` y `/admin/nodos` **sin abrir el formulario** (0 diálogos) | Un clic que no hace lo que dice |
| 9 | «Ver Planes» y «Cambiar Contraseña» **no hacen nada** | Sin `onClick` en `ProfilePage.tsx` (líneas 191 y 199); al pulsar: 0 diálogos y la ruta no cambia. «Plan Profesional» está escrito a mano (línea 185) | Botones muertos; decisión pendiente |
| 10 | «Editar Perfil» solo habilita el nombre | 1 campo habilitado (el correo está `disabled`) | Esperado, pero no se explica |
| 11 | `/cliente/predio/:id` huérfana | La página existe y carga («Sensores por Área», nodos, equipo), pero no hay ningún enlace hacia ella | Ruta inalcanzable |
| 12 | Tabla/tarjetas de clientes cortan acciones | 768 px: **24 de 48** botones (Editar, Predios, Dashboard, Borrar) caben en el viewport. 390 px (tarjetas): 60 de 72; «Dashboard» se ve como «Dashb…» | La mitad de las acciones no se ve en tableta |
| 13 | Alta completa repartida | Ver `03-flujos.md`: **31 acciones, 6 pantallas, 1 URL escrita a mano** (igual en 390 y 1366 px) | Muchos pasos y uno oculto |
| 14 | Valores de un área **sin comunicación** se muestran como actuales | Área Granja Hogar: «62.85 %» y «0 L/min» en tarjetas oscuras iguales a las de un área al día, con «SIN COMUNICACION» solo en una tarjeta aparte | El número engaña si no se mira el aviso |
| 15 | Textos sin tilde | «SIN COMUNICACION», «Hace 2 dias», «Hace 1 dia» (`utils/datetime.ts`, carpeta protegida) | Error ortográfico visible |
| 16 | Errores de red en pantallas normales | `/cliente`: 409 `weather/current` y 404 `ndvi-snapshots/latest`. `/cliente/areas` y `/cliente/predio/:id`: 404 `properties/:id/gateway/status` para predios sin equipo | Rojo en consola por respuestas esperadas («sin dato»), ruido para depurar |
| 17 | **Rutas de Fase 2 alcanzables por URL con el módulo apagado** | El menú las oculta, pero `/cliente/alertas`, `/umbrales`, `/notificaciones`, `/asistente-ia`, `/cliente/reportes-ia`, `/admin/consumo-ia`, `/admin/reportes-ia` cargan; tres devuelven 503 (`ai-reports`, `ai-assistant/usage`) | Conservar el gate por módulo; no se debe «arreglar» encendiendo flags |
| 18 | El mapa avisa por nodo sin GPS | 3 avisos de MapLibre «Expected value to be of type number, but found null» en `/cliente/mapa` y `/admin/mapa` (nodo sin latitud) | Ruido; los nodos sin GPS deben listarse aparte |
| 19 | Datos de laboratorio en la lista de Equipos | `/admin/gateways`: 15 filas, casi todas «E2E … Predio» (restos de las pruebas E2E) con enlaces «Ver detalle» | Es dato de prueba, no del producto; en v2 conviene separar revocados |
| 20 | «Equipo pendiente» en áreas con equipo creado | Las 4 áreas DEMO muestran «Equipo pendiente»; la API da `status: never_seen`, `edge_status: pending`, todas las ranuras `unbound` | **Correcto**: el equipo existe pero nunca se conectó (las lecturas son simuladas). No es un error |
| 21 | Fallback inventado en el predio | `PropertyDetail.tsx:179` usa «Chihuahua, Chihuahua» si no hay ubicación | **Solo código, no reproducido**: los 3 predios de la copia tienen ubicación |

## Diferencias entre roles

- **Productor** (menú: Dashboard, Predios, Mapa, Histórico, Exportar, Perfil; los de Fase 2 solo con módulo): solo lectura y descarga. Sin acciones de escritura salvo el nombre del perfil.
- **Admin** (menú: Dashboard, Clientes, Mapa, Nodos, Equipos, Catálogo, Auditoría; Ciclos sin enlace): todas las altas y bajas. Ningún acceso a las pantallas del productor.
- Cada rol recibe `Navigate` a su inicio ante una ruta desconocida o ajena (`/cliente/inexistente` → `/cliente`; `/admin/inexistente` → `/admin`; `/admin/recorrido-v2` → `/admin/gateways`).

## Funciones en código no accesibles desde la interfaz

| Función | Estado |
|---|---|
| Ciclos de cultivo (`/admin/ciclos`) | Sin enlace de menú; solo por URL |
| Detalle de predio (`/cliente/predio/:id`) | Sin enlace |
| `/admin/recorrido-v2` | Redirección heredada a `/admin/gateways` |
| Alertas, Umbrales, Notificaciones, Asistente IA, Reportes IA, Consumo IA | Gate por módulo; solo por URL, y parcialmente con 503 (Fase 2 apagada, es lo esperado) |
| Edición de ciclos | No existe; solo crear y eliminar |

## Tareas recorridas

Resultado detallado de cada tarea (pasos, pantallas, errores) en `03-flujos.md`. Resumen de lo recorrido de principio a fin en ambos viewports: ver todas las áreas, consultar un área, cambiar de predio y área, filtrar y descargar CSV (por Histórico y por Exportar), mapa, perfil, panel del admin, alta cliente → predio → área → ciclo → nodo, asistente de equipo (solo paso 1), catálogo, auditoría, nodo y equipo (detalle).

## Evidencia y cómo repetirla

Todo en `docs/redesign/v2/audit/`:

| Archivo | Contenido |
|---|---|
| `lib.mjs`, `lib-axe.mjs` | Utilidades. `lib.mjs` **solo corre contra `:5174`** |
| `10-crawl.mjs` → `results/crawl.json` | Cada ruta × rol × viewport: URL final, títulos, errores HTTP y de consola, desborde horizontal |
| `20-controls.mjs` → `results/controls.json` | Botones, enlaces y campos visibles de cada pantalla (base de `04-paridad.md`) |
| `21-dialogs.mjs` | Campos de cada formulario de alta |
| `30-flow-admin-alta.mjs` → `results/flow-admin-alta.json` | Alta completa medida |
| `31-flow-cliente.mjs` → `results/flow-cliente.json` | Tareas del productor medidas |
| `32-extras.mjs` → `results/extras.json` | Barra móvil, objetivos táctiles, 768/390 px, rol admin en `/cliente` |
| `40-proto-test.mjs`, `41-proto-interact.mjs`, `42-proto-targets.mjs` | Pruebas del **prototipo** (ver `05-prototipo-y-visual.md`) |
| `screens/` | 78 capturas JPEG de `main`. Se **retiraron** las que mostraban correos reales (perfil, lista de clientes) |

Para repetirla: levantar el stack aislado (abajo), y `node 10-crawl.mjs` desde `v2/audit/`. Los scripts importan Playwright desde `frontend/node_modules`.

```bash
# 1. copia de la base (solo lectura sobre la original)
docker exec -e MYSQL_PWD="$DB_PASSWORD" sensores_mysql mysqldump -uroot --single-transaction --no-tablespaces --routines sensores_riego > dump.sql
docker run -d --name audit_mysql -e MYSQL_ROOT_PASSWORD=auditpass -e MYSQL_DATABASE=sensores_riego -p 127.0.0.1:3307:3306 mysql:8.0
docker exec -i audit_mysql mysql -uroot -pauditpass sensores_riego < dump.sql
# 2. backend aislado
cd backend && DB_HOST=127.0.0.1 DB_PORT=3307 DB_PASSWORD=auditpass LOGIN_RATE_LIMIT_MAX_ATTEMPTS=100000 uv run uvicorn app.main:app --port 5051
# 3. frontend de main: extraer, enlazar node_modules y apuntar el proxy a :5051
git archive af67be8 frontend | tar -x -C /tmp/main-fe && ln -s "$PWD/frontend/node_modules" /tmp/main-fe/frontend/node_modules
sed -i '' 's#localhost:5050#localhost:5051#' /tmp/main-fe/frontend/vite.config.ts && (cd /tmp/main-fe/frontend && npx vite --port 5174 --strictPort)
```

Al terminar: `docker rm -f audit_mysql`, parar `uvicorn` y `vite`. **El dump contiene datos reales: guardarlo fuera del repo y borrarlo.**

**Credenciales locales:** `admin@sensores.com` / `admin123`; `alan2203mx@gmail.com` / `123`. Stack normal: `make dev`; frontend `:5173`, backend `:5050`, MySQL `:3306`.

## Correcciones a la propuesta por lo medido

- La cifra «13 acciones» del alta en `main` era derivada. **Medido: 31 acciones** (14 clics, 13 campos escritos, 3 selecciones y 1 URL manual) en 6 pantallas. El método cuenta cada acción del usuario.
- «A 768 px ninguna acción se ve» era demasiado fuerte. **Medido:** caben 24 de 48.
- Se añaden los hallazgos 8, 14, 17, 19 y 20, que no estaban.
- Lo previsto sobre Mis predios, Área, Hoy y Directorio se mantiene; ningún dato contradice la dirección aprobada.
