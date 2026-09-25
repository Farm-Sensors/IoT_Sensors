import { lazy, Suspense } from "react";
import { Navigate, createBrowserRouter } from "react-router";
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
import { AreaSelector } from "./pages/client/AreaSelector";
import { ClientDashboard } from "./pages/client/ClientDashboard";
import { ExportData } from "./pages/client/ExportData";
import { HistoricalData } from "./pages/client/HistoricalData";
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
import { ClientManagement } from "./pages/admin/ClientManagement";
import { CropCycleManagement } from "./pages/admin/CropCycleManagement";
import { CropTypeManagement } from "./pages/admin/CropTypeManagement";
import { IrrigationAreaManagement } from "./pages/admin/IrrigationAreaManagement";
import { NodeDetail } from "./pages/admin/NodeDetail";
import { GatewayManagement } from "./pages/admin/GatewayManagement";
import { NodeManagement } from "./pages/admin/NodeManagement";
import { PropertyManagement } from "./pages/admin/PropertyManagement";

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
        path: "cliente",
        element: <ProtectedRoute allowedRole="cliente" />,
        children: [
          {
            Component: ClientLayout,
            children: [
              {
                index: true,
                Component: ClientDashboard,
              },
              {
                path: "areas",
                Component: AreaSelector,
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
                path: "historico",
                Component: HistoricalData,
              },
              {
                path: "exportar",
                Component: ExportData,
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
                Component: ClientManagement,
              },
              {
                path: "clientes/:clientId/predios",
                Component: PropertyManagement,
              },
              {
                path: "predios/:predioId/areas",
                Component: IrrigationAreaManagement,
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
