import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  FileSearch,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BentoCard } from "../../components/BentoCard";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import {
  AuditLogItem,
  getAuditLog,
  listAuditLogs,
} from "../../services/auditLogs";

const PAGE_SIZE = 20;

// Nombres en español de lo que escribe el sistema en el registro; si llega uno nuevo se muestra tal cual.
const ACTION_LABELS: Record<string, string> = {
  create: "Creación", update: "Cambio", delete: "Eliminación", execute: "Ejecución", error: "Error", rate_limited: "Límite excedido",
};
const ENTITY_LABELS: Record<string, string> = {
  password_recovery: "Recuperación de contraseña",
  password_reset_forgot_email: "Recuperación de contraseña (correo)",
  password_reset_forgot_ip: "Recuperación de contraseña (IP)",
  password_reset_confirm_ip: "Recuperación de contraseña (confirmación)",
  threshold: "Umbral", alert: "Alerta", inactivity_scan: "Revisión de inactividad", notification_preference: "Preferencia de notificación",
  alert_notification_dispatch: "Envío de notificación", alert_ai_recommendation: "Recomendación de IA",
  ai_assistant_chat: "Asistente de IA", ai_report_generation: "Reporte de IA",
};
const actionLabel = (value: string) => ACTION_LABELS[value] ?? value;
const entityLabel = (value: string) => ENTITY_LABELS[value] ?? value;
const FILTER_ENTITIES = ["password_recovery", "threshold", "alert", "inactivity_scan", "notification_preference", "alert_notification_dispatch", "ai_assistant_chat", "ai_report_generation"];
const FILTER_ACTIONS = ["create", "update", "delete", "execute", "error", "rate_limited"];

function formatRelativeDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return formatDistanceToNowStrict(parsed, { addSuffix: true, locale: es });
}

export function AuditLogsPage() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const normalizedItems = useMemo(
    () => items.filter((item) => Boolean(item.id)),
    [items],
  );

  const fetchAuditLogs = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await listAuditLogs({
        page,
        per_page: PAGE_SIZE,
        action: action || undefined,
        entity: entity || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setItems(response.data ?? []);
      setTotal(response.total ?? 0);
    } catch (error) {
      console.error("Failed to fetch audit logs", error);
      setErrorMessage("No fue posible cargar el registro de eventos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [page, action, entity, startDate, endDate]);

  const openLogDetail = async (logId: number) => {
    setLoadingDetail(true);
    setErrorMessage(null);

    try {
      const detail = await getAuditLog(logId);
      setSelectedLog(detail);
    } catch (error) {
      console.error("Failed to fetch audit log detail", error);
      setErrorMessage("No fue posible cargar el detalle del evento");
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <PageTransition>
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-title)]">Registro de eventos</h1>
          <p className="text-[var(--text-subtle)]">
            Restablecimientos de contraseña y, cuando se activen, alertas y umbrales
          </p>
        </div>

        <PillButton type="button" variant="outline" onClick={fetchAuditLogs}>
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </PillButton>
      </div>

      <BentoCard variant="light" className="mb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
            Acción
            <select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} className="min-h-[44px] rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-panel)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
              <option value="">Todas</option>
              {FILTER_ACTIONS.map((value) => <option key={value} value={value}>{actionLabel(value)}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
            Qué se registró
            <select value={entity} onChange={(event) => { setEntity(event.target.value); setPage(1); }} className="min-h-[44px] rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-panel)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
              <option value="">Todo</option>
              {FILTER_ENTITIES.map((value) => <option key={value} value={value}>{entityLabel(value)}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
            Desde
            <input
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                setPage(1);
              }}
              className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-panel)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
            Hasta
            <input
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setPage(1);
              }}
              className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-panel)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </label>
        </div>
      </BentoCard>

      <BentoCard variant="light" className="overflow-hidden">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-[var(--text-subtle)]">
            {total} {total === 1 ? "evento registrado" : "eventos registrados"}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              disabled={page <= 1}
              className="rounded-full border border-[var(--border-strong)] bg-[var(--surface-panel)] p-2 text-[var(--text-subtle)] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-[var(--text-subtle)]">
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
              disabled={page >= totalPages}
              className="rounded-full border border-[var(--border-strong)] bg-[var(--surface-panel)] p-2 text-[var(--text-subtle)] disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[var(--text-subtle)]">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando eventos…
          </div>
        ) : errorMessage ? (
          <div className="rounded-2xl border border-[var(--status-danger)]/25 bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-text)]">
            {errorMessage}
          </div>
        ) : normalizedItems.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-panel)] px-3 py-6 text-center text-sm text-[var(--text-subtle)]">
            {action || entity || startDate || endDate ? "Ningún evento coincide con el filtro." : "Aún no hay eventos registrados. Aquí aparecen los restablecimientos de contraseña y, cuando se activen, las alertas y los umbrales."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-strong)]">
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Fecha</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Usuario</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Acción</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Qué se registró</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Detalle</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Ver</th>
                </tr>
              </thead>
              <tbody>
                {normalizedItems.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? "bg-[var(--surface-card-primary)]/60" : ""}>
                    <td className="px-3 py-3 text-sm text-[var(--text-main)]">
                      {formatRelativeDate(item.created_at)}
                    </td>
                    <td className="px-3 py-3 text-sm text-[var(--text-main)]">
                      {item.user?.full_name ?? "Sistema"}
                    </td>
                    <td className="px-3 py-3 text-sm text-[var(--text-main)]">{actionLabel(item.action)}</td>
                    <td className="px-3 py-3 text-sm text-[var(--text-main)]">
                      {entityLabel(item.entity)}
                      {item.entity_id ? ` #${item.entity_id}` : ""}
                    </td>
                    <td className="px-3 py-3 text-sm text-[var(--text-subtle)] max-w-[420px] truncate">
                      {item.detail ?? "-"}
                    </td>
                    <td className="px-3 py-3">
                      <PillButton type="button" variant="outline" className="px-3 py-1 text-xs" onClick={() => openLogDetail(item.id)}>
                        <FileSearch className="h-3.5 w-3.5" />
                        Detalle
                      </PillButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </BentoCard>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface-page)]/75 backdrop-blur-sm p-4">
          <BentoCard variant="light" className="w-full max-w-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-serif text-[var(--text-title)]">Detalle de evento #{selectedLog.id}</h2>
              <button type="button" onClick={() => setSelectedLog(null)} className="rounded-full p-1 text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex items-center gap-2 text-[var(--text-subtle)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando detalle...
              </div>
            ) : (
              <div className="space-y-2 text-sm text-[var(--text-main)]">
                <p><strong>Fecha:</strong> {selectedLog.created_at}</p>
                <p><strong>Usuario:</strong> {selectedLog.user?.full_name ?? "Sistema"}</p>
                <p><strong>Email:</strong> {selectedLog.user?.email ?? "-"}</p>
                <p><strong>Acción:</strong> {actionLabel(selectedLog.action)}</p>
                <p><strong>Qué se registró:</strong> {entityLabel(selectedLog.entity)}</p>
                <p><strong>ID Entidad:</strong> {selectedLog.entity_id ?? "-"}</p>
                <p><strong>Detalle:</strong> {selectedLog.detail ?? "-"}</p>
              </div>
            )}
          </BentoCard>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
