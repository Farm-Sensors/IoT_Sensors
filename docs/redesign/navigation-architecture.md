# Arquitectura de navegación

Alcance: solo módulos activos en el MVP. Las rutas de Fase 2 no cambian, conservan su gate de menú y aparecen aquí solo para marcar que quedan intactas.

## 1. Estructura actual

```mermaid
flowchart TD
  L["/ Login"] --> C
  L --> A
  subgraph C["Cliente · 6 ítems visibles"]
    C0["/cliente Dashboard"] --- C1["/cliente/areas Predios"]
    C0 --- C2["/cliente/mapa Mapa"]
    C0 --- C3["/cliente/historico Histórico"]
    C0 --- C4["/cliente/exportar Exportar"]
    C0 --- C5["/cliente/perfil Perfil"]
    C6["/cliente/predio/:id (sin enlace)"]
  end
  subgraph A["Admin · 7 ítems visibles"]
    A0["/admin Dashboard"] --- A1["/admin/clientes Clientes"]
    A1 -->|botón de fila| A2["/admin/clientes/:id/predios"]
    A2 -->|botón de fila| A3["/admin/predios/:id/areas"]
    A1 -->|botón de fila| A4["/admin/clientes/:id/dashboard"]
    A0 --- A5["/admin/mapa Mapa"]
    A0 --- A6["/admin/nodos Nodos"]
    A0 --- A7["/admin/gateways Equipos"]
    A0 --- A8["/admin/cultivos Catálogo"]
    A0 --- A9["/admin/auditoria Auditoría"]
    A10["/admin/ciclos (sin enlace)"]
  end
```

Problemas que resuelve la propuesta: N1 (ítems ocultos en móvil), N2 y N4 (rutas sin entrada), N3 (jerarquía solo por botones de fila), N5 (dos rutas de alta de nodos), N6 (contexto repetido), F1 (exportar duplicado).

## 2. Estructura propuesta

### Cliente

| Antes | Después | Motivo |
|---|---|---|
| Menú: Dashboard, Predios, Mapa, Histórico, Exportar, Perfil (6) | Menú: **Inicio, Histórico, Mapa** (3) + **Cuenta** | Menos destinos; exportar está en Histórico |
| «Predios» como destino | **Selector de contexto** en el encabezado (Predio › Área ▾) con «Ver todos los predios» → `/cliente/areas` | N6, F4: cambiar de área desde cualquier pantalla |
| «Exportar» | Redirige a Histórico (que ya descarga CSV, Excel y PDF) | F1 |
| «Perfil», tema, salir | Menú de **Cuenta** (avatar en escritorio; pestaña en móvil) | N1 |
| `/cliente/predio/:id` sin enlace | Destino de «Ver predio» desde el selector | N4 (sujeto a decisión, ver riesgos) |

### Admin

Tres grupos:

| Grupo | Ítems | Cambios |
|---|---|---|
| **Operación** | Dashboard, Mapa, Equipos | Orden por uso diario |
| **Clientes y terrenos** | Clientes (con Predios y Áreas por migas y conteos), Nodos, Catálogo, **Ciclos** | **Ciclos** gana entrada (N2) |
| **Sistema** | Auditoría | Sin cambio de ruta ni de gate |

Móvil: pestañas **Inicio, Clientes, Equipos, Más** (las entradas de Fase 2, si su módulo está activo, van dentro de «Sistema» y de la hoja); «Más» agrupa Mapa, Nodos, Catálogo, Ciclos, Auditoría, tema y salir.

```mermaid
flowchart TD
  L["/ Login"] --> C & A
  subgraph C["Cliente · 3 ítems + Cuenta"]
    CS["Selector de contexto (todas las pantallas)"]
    C0["/cliente Inicio"]
    C3["/cliente/historico Histórico + descarga"]
    C2["/cliente/mapa Mapa"]
    CA["Cuenta: /cliente/perfil · tema · salir"]
    C1["/cliente/areas Todos los predios"]
    CS --> C1
    C4["/cliente/exportar"] -.redirige.-> C3
  end
  subgraph A["Admin · 3 grupos"]
    subgraph G1["Operación"]
      A0["/admin Dashboard"]
      A5["/admin/mapa Mapa"]
      A7["/admin/gateways Equipos"]
    end
    subgraph G2["Clientes y terrenos"]
      A1["/admin/clientes"] --> A2["…/predios"] --> A3["…/areas"]
      A6["/admin/nodos"]
      A8["/admin/cultivos Catálogo"]
      A10["/admin/ciclos Ciclos"]
      A3 -->|fila de área| A10
      A3 -->|fila de área| A6
    end
    subgraph G3["Sistema"]
      A9["/admin/auditoria"]
    end
  end
```

## 3. Tabla de rutas

No se elimina ninguna ruta y ninguna cambia de ruta. Lo único que cambia es su visibilidad en el menú y que una pasa a redirigir.

| Ruta | Cambio |
|---|---|
| `/cliente/exportar` | Redirige a `/cliente/historico` (la descarga queda en Histórico); se conserva el enlace antiguo |
| `/cliente/areas` | Sale del menú, se alcanza desde el selector de contexto |
| `/admin/ciclos` | Entra al menú (hoy sin entrada) |
| `/admin/clientes?nuevo=1`, `/admin/nodos?area=ID&nuevo=1`, `/admin/ciclos?area=ID&nuevo=1` | **Parámetros nuevos** que abren el diálogo; las rutas son las mismas |
| `/pair`, `/admin/gateways/pair` | **Intactas** (contrato con la Raspberry) |
| Todas las de Fase 2 | **Intactas**, con el mismo gate de menú |
| Resto | Sin cambio |

## 4. Principios

- La jerarquía Cliente → Predio → Área → (Cultivo + Nodo) es el modelo del negocio; la navegación la **refleja con migas clicables**, no la oculta.
- Todo destino de primer nivel está a una acción; los niveles de la jerarquía (Cliente → Predio → Área) se alcanzan con migas clicables y enlaces de fila, sin volver al principio.
- Móvil y escritorio comparten la misma lista de destinos; solo cambia el contenedor (pestañas frente a barra lateral). Hoy ambos leen `items.ts`; se mantiene esa fuente única.
- El orden de los ítems sigue el uso, no el orden de construcción del sistema.

## 5. Qué no se inventa

El selector de contexto reutiliza `SelectionContext`; «Más» y «Cuenta» reubican ítems existentes; los parámetros `?nuevo=1` extienden un patrón que Equipos ya usa. No se añaden pantallas ni funciones.
