import { lazy, Suspense } from "react";
import { Navigate, createBrowserRouter, useSearchParams } from "react-router";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminLayout } from "./layouts/AdminLayout";
import { ClientLayout } from "./layouts/ClientLayout";
import { RootLayout } from "./layouts/RootLayout";
import { loadAdminMapPage, loadClientMapPage } from "./services/routePreload";

// Auth pages
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";

// Client pages
import { ThresholdManagement } from "./pages/admin/ThresholdManagement";
import { AreaDetails } from "./pages/client/area/AreaDetails";
import { AreaLayout } from "./pages/client/area/AreaLayout";
import { AreaHistory, AreaNow, ToAreaHistory } from "./pages/client/area/AreaTabs";
import { PropertiesOverview } from "./pages/client/PropertiesOverview";
import { NotificationPreferencesPage } from "./pages/client/NotificationPreferencesPage";
import { ProfilePage } from "./pages/client/ProfilePage";
import { PropertyDetail } from "./pages/client/PropertyDetail";
import { AlertDetailPage } from "./pages/shared/AlertDetailPage";
import { AlertsCenterPage } from "./pages/shared/AlertsCenterPage";
import { AIChatPage } from "./pages/shared/AIChatPage";
import { AIReportDetailPage } from "./pages/shared/AIReportDetailPage";
import { AIReportsPage } from "./pages/shared/AIReportsPage";

// Admin pages
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AIAssistantUsagePage } from "./pages/admin/AIAssistantUsagePage";
import { AuditLogsPage } from "./pages/admin/AuditLogsPage";
import { ClientDirectory } from "./pages/admin/ClientDirectory";
import { CropCycleManagement } from "./pages/admin/CropCycleManagement";
import { CropTypeManagement } from "./pages/admin/CropTypeManagement";
import { DashboardPreferences } from "./pages/admin/DashboardPreferences";
import { NodeDetail } from "./pages/admin/NodeDetail";
import { GatewayManagement } from "./pages/admin/GatewayManagement";
import { GatewayDetail } from "./pages/admin/GatewayDetail";
import { PairDevice } from "./pages/admin/PairDevice";
import { NodeManagement } from "./pages/admin/NodeManagement";

const ClientMapPage = lazy(() => loadClientMapPage().then((module) => ({ default: module.ClientMapPage })));

const AdminMapPage = lazy(() => loadAdminMapPage().then((module) => ({ default: module.AdminMapPage })));

function PageFallback() {
  return (
    <div className="min-h-[45vh] grid place-items-center text-[var(--text-muted)] text-sm">
      Cargando vista...
    </div>
  );
}

function RootLayoutWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <RootLayout />
    </ErrorBoundary>
  );
}

/**
 * Public entry point for the device `verification_uri`. Forwards to the admin
 * verification page keeping the `?code=` carried by `verification_uri_complete`;
 * the protected route then returns the visitor to login with that path intact.
 */
function PairRedirect() {
  const [searchParams] = useSearchParams();
  const query = searchParams.toString();
  return <Navigate to={`/admin/gateways/pair${query ? `?${query}` : ""}`} replace />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayoutWithErrorBoundary,
    children: [
      {
        index: true,
        Component: LoginPage,
      },
      {
        path: "recuperar-contrasena",
        Component: ForgotPasswordPage,
      },
      {
        path: "restablecer-contrasena",
        Component: ResetPasswordPage,
      },
      {
        path: "pair",
        Component: PairRedirect,
      },
      {
        path: "cliente",
        element: <ProtectedRoute allowedRole="cliente" />,
        children: [
          {
            Component: ClientLayout,
            children: [
              {
                index: true,
                Component: PropertiesOverview,
              },
              {
                path: "area/:areaId",
                Component: AreaLayout,
                children: [
                  { index: true, Component: AreaNow },
                  { path: "historial", Component: AreaHistory },
                  { path: "detalles", Component: AreaDetails },
                ],
              },
              {
                // Ruta antigua: la lista de predios es ahora la portada.
                path: "areas",
                element: <Navigate to="/cliente" replace />,
              },
              {
                path: "mapa",
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <ClientMapPage />
                  </Suspense>
                ),
              },
              {
                // Rutas antiguas: el historial y la descarga viven en Área › Historial.
                path: "historico",
                Component: ToAreaHistory,
              },
              {
                path: "exportar",
                Component: ToAreaHistory,
              },
              {
                path: "alertas",
                Component: AlertsCenterPage,
              },
              {
                path: "alertas/:alertId",
                Component: AlertDetailPage,
              },
              {
                path: "reportes-ia",
                Component: AIReportsPage,
              },
              {
                path: "asistente-ia",
                Component: AIChatPage,
              },
              {
                path: "reportes-ia/:reportId",
                Component: AIReportDetailPage,
              },
              {
                path: "notificaciones",
                Component: NotificationPreferencesPage,
              },
              {
                path: "umbrales",
                Component: ThresholdManagement,
              },
              {
                path: "perfil",
                Component: ProfilePage,
              },
              {
                path: "predio/:predioId",
                Component: PropertyDetail,
              },
              {
                path: "*",
                element: <Navigate to="/cliente" replace />,
              },
            ]
          }
        ],
      },
      {
        path: "admin",
        element: <ProtectedRoute allowedRole="admin" />,
        children: [
          {
            Component: AdminLayout,
            children: [
              {
                index: true,
                Component: AdminDashboard,
              },
              {
                path: "clientes",
                Component: ClientDirectory,
              },
              {
                path: "clientes/:clientId/predios",
                Component: ClientDirectory,
              },
              {
                path: "clientes/:clientId/dashboard",
                Component: DashboardPreferences,
              },
              {
                path: "areas/:areaId",
                Component: ClientDirectory,
              },
              {
                path: "predios/:predioId/areas",
                Component: ClientDirectory,
              },
              {
                path: "cultivos",
                Component: CropTypeManagement,
              },
              {
                path: "ciclos",
                Component: CropCycleManagement,
              },
              {
                path: "nodos",
                Component: NodeManagement,
              },
              {
                path: "gateways",
                Component: GatewayManagement,
              },
              {
                path: "gateways/pair",
                Component: PairDevice,
              },
              {
                path: "gateways/:gatewayId",
                Component: GatewayDetail,
              },
              {
                path: "recorrido-v2",
                element: <Navigate to="/admin/gateways" replace />,
              },
              {
                path: "mapa",
                element: (
                  <Suspense fallback={<PageFallback />}>
                    <AdminMapPage />
                  </Suspense>
                ),
              },
              {
                path: "nodos/:nodeId",
                Component: NodeDetail,
              },
              {
                path: "alertas",
                Component: AlertsCenterPage,
              },
              {
                path: "alertas/:alertId",
                Component: AlertDetailPage,
              },
              {
                path: "reportes-ia",
                Component: AIReportsPage,
              },
              {
                path: "asistente-ia",
                Component: AIChatPage,
              },
              {
                path: "consumo-ia",
                Component: AIAssistantUsagePage,
              },
              {
                path: "reportes-ia/:reportId",
                Component: AIReportDetailPage,
              },
              {
                path: "umbrales",
                Component: ThresholdManagement,
              },
              {
                path: "auditoria",
                Component: AuditLogsPage,
              },
              {
                path: "*",
                element: <Navigate to="/admin" replace />,
              },
            ]
          }
        ],
      },
    ],
  },
]);
