# Componentes

La base es `main` (`af67be8`).

## Conservar sin cambios de lógica

- `frontend/src/app/services/`, `types/`, `utils/`.
- `pages/client/dashboard/helpers.ts`, `readings.ts`.
- `useReadingFilters`, `useGeoNodesData`, `useModules`, `usePageVisibility`, `usePropertyGatewayStatus`.
- `AuthContext`, `SelectionContext`, `ProtectedRoute`, `ErrorBoundary`.
- `components/maps/mapHelpers.ts`: la lógica; solo el aspecto del marcador puede cambiar.
- Primitivas Radix de `components/ui/`, reestilizadas si hace falta.
- Lógica de frescura de `FreshnessIndicator` y de `EquipoStateBadge`.
- Comportamiento de `ConfirmDialog`, `PairingApprovalPanel`, `RevokeLinkButton` y del asistente de `GatewayManagement`.

## Reemplazar

| Actual en `main` | Nuevo |
|---|---|
| `DesktopSidebar`, `MobileTabBar`, `ClientLayout`, `AdminLayout` | Marco con barra superior y pestañas móviles |
| `ClientDashboard`, `DesktopDashboard`, `MobileDashboard`, `HistoricalData`, `ExportData` | Área: Ahora, Historial y Detalles, con la misma obtención de datos |
| `AreaSelector`, `PropertyDetail`, `ClientMapPage` | Mis predios |
| `AdminDashboard` | Hoy, con las mismas peticiones |
| `ClientManagement`, `PropertyManagement`, `IrrigationAreaManagement`, `CropCycleManagement`, `DashboardPreferences` | Directorio |
| `NodeManagement`, `NodeDetail`, `GatewayManagement`, `GatewayDetail`, `AdminMapPage` | Red |
| `CropTypeManagement`, `AuditLogsPage` | Ajustes: cambia el marco; Auditoría es de Fase 2 y su lógica no se toca |
| `BentoCard`, `MetricCard`, `PillButton`, `PageHeader`, `FormDialog` | Sistema de componentes de la identidad nueva |
| `theme.css` | Tokens nuevos |

**Fase 2** no se reescribe: heredan solo el cambio de estilos base del marco.

## Crear

Marco y barra superior, fila de área, área de trabajo con pestañas, árbol y panel del directorio, bandeja Hoy y panel lateral de formularios. Nombres a fijar en la implementación.
