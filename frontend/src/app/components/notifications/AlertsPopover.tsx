import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, Check, CheckCheck, ChevronRight, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

import { useAlertPlaces } from "../../hooks/useAlertPlaces";
import { usePageVisibility } from "../../hooks/usePageVisibility";
import { describeReading, SEVERITY_META } from "../../pages/shared/alertFormat";
import {
  AlertItem,
  getUnreadAlertsCount,
  listAlerts,
  markAllAlertsRead,
  markAlertRead,
} from "../../services/alerts";
import { parseBackendTimestamp } from "../../utils/datetime";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface AlertsPopoverProps {
  className?: string;
  refreshIntervalMs?: number;
}

function formatRelativeDate(iso: string): string {
  const parsed = parseBackendTimestamp(iso);
  if (!parsed) return iso;
  return formatDistanceToNowStrict(parsed, { addSuffix: true, locale: es });
}

/**
 * Campana de alertas del encabezado: las últimas alertas con su gravedad (icono y texto), dónde ocurrieron
 * y cuándo. Cada fila lleva al detalle; marcar como leída es una acción discreta. Ver la lista completa
 * en «Todas las alertas» / «Mis alertas».
 */
export function AlertsPopover({
  className = "fixed top-4 right-4 md:right-6 z-40",
  refreshIntervalMs = 30000,
}: AlertsPopoverProps) {
  const fixedBottomRightClassName =
    "fixed !right-4 !top-auto !left-auto !z-[60] !bottom-[calc(6rem+env(safe-area-inset-bottom))] sm:!bottom-4";

  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const { placeOf } = useAlertPlaces(isAdmin);
  const isPageVisible = usePageVisibility();
  const isAlertsPage = location.pathname.endsWith("/alertas");
  const hasLoadedRef = useRef(false);
  const loadingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());
  const [leavingIds, setLeavingIds] = useState<Set<number>>(new Set());
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const alertsPagePath = isAdmin ? "/admin/alertas" : "/cliente/alertas";
  const alertDetailBasePath = alertsPagePath;

  const loadAlerts = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!hasLoadedRef.current) setLoading(true);
    setErrorMessage(null);

    try {
      const [alertsPage, unreadCountValue] = await Promise.all([
        listAlerts({ page: 1, per_page: 12, read: false }),
        getUnreadAlertsCount(),
      ]);

      setAlerts(alertsPage.data ?? []);
      setUnreadCount(unreadCountValue);
      hasLoadedRef.current = true;
    } catch (error) {
      console.error("Failed to load alerts", error);
      setErrorMessage("No fue posible cargar las alertas");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isPageVisible || isAlertsPage) return;

    loadAlerts();

    const intervalId = window.setInterval(() => {
      loadAlerts();
    }, refreshIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshIntervalMs, loadAlerts, isPageVisible, isAlertsPage]);

  const handleMarkRead = async (alertId: number) => {
    setUpdatingIds((previous) => new Set(previous).add(alertId));

    try {
      await markAlertRead(alertId, true);
      setUnreadCount((previous) => Math.max(0, previous - 1));
      // La alerta se va con un barrido a la derecha y luego sale de la lista (la campana solo muestra lo sin leer).
      setLeavingIds((previous) => new Set(previous).add(alertId));
      window.setTimeout(() => {
        setAlerts((previous) => previous.filter((item) => item.id !== alertId));
        setLeavingIds((previous) => {
          const next = new Set(previous);
          next.delete(alertId);
          return next;
        });
      }, 420);
    } catch (error) {
      console.error("Failed to mark alert as read", error);
      setErrorMessage("No fue posible actualizar la alerta");
    } finally {
      setUpdatingIds((previous) => {
        const next = new Set(previous);
        next.delete(alertId);
        return next;
      });
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAllRead(true);
    setErrorMessage(null);

    try {
      await markAllAlertsRead();
      await loadAlerts();
    } catch (error) {
      console.error("Failed to mark all alerts as read", error);
      setErrorMessage("No fue posible marcar todas como leídas");
    } finally {
      setMarkingAllRead(false);
    }
  };

  return (
    <div className={className + " " + fixedBottomRightClassName}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-main)] shadow-sm transition-colors hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-label={unreadCount > 0 ? `Alertas, ${unreadCount} sin leer` : "Alertas"}
          >
            <Bell aria-hidden="true" className="h-5 w-5" />
            {unreadCount > 0 && (
              <span
                key={unreadCount}
                aria-hidden="true"
                className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--status-danger-solid)] px-1.5 py-0.5 text-center text-[11px] font-semibold text-white animate-badge-pop"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="w-[min(92vw,420px)] rounded-[var(--radius)] border-[var(--border-strong)] bg-[var(--bg-elevated)] p-0 shadow-xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-main)]">Alertas</h3>
              <p className="text-xs text-[var(--text-muted)]">
                {unreadCount === 0 ? "Todo leído" : unreadCount === 1 ? "1 sin leer" : `${unreadCount} sin leer`}
              </p>
            </div>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markingAllRead || unreadCount === 0}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius)] px-2 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {markingAllRead ? (
                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCheck aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              Marcar todas como leídas
            </button>
          </div>

          <div className="max-h-[62vh] overflow-y-auto p-3">
            {loading ? (
              <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--text-muted)]">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                Cargando alertas…
              </div>
            ) : errorMessage ? (
              <div role="alert" className="rounded-[var(--radius)] bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-text)]">
                {errorMessage}
              </div>
            ) : alerts.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
                No tienes alertas sin leer. Las que ya leíste están en «{isAdmin ? "Todas las alertas" : "Mis alertas"}».
              </p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((item) => {
                  const meta = SEVERITY_META[item.severity];
                  const Icon = meta.icon;
                  const isUpdating = updatingIds.has(item.id);
                  const reading = item.detected_value !== null && item.message.includes(String(item.detected_value)) ? null : describeReading(item);

                  return (
                    <li
                      key={item.id}
                      className={`flex items-stretch overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] ${leavingIds.has(item.id) ? "alert-sweep-out" : ""}`}
                    >
                      <span aria-hidden="true" className={`w-1 flex-shrink-0 ${meta.bar}`} />
                      <Link
                        to={`${alertDetailBasePath}/${item.id}`}
                        onClick={() => setOpen(false)}
                        className="group flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${meta.bg} ${meta.text}`}>
                              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                              {meta.label}
                            </span>
                            <span className="ml-auto text-[var(--text-muted)]">{formatRelativeDate(item.timestamp)}</span>
                          </div>
                          <p className={`text-sm text-[var(--text-main)] ${item.read ? "" : "font-semibold"}`}>{item.message}</p>
                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                            {placeOf(item.irrigation_area_id).where}
                            {reading ? ` · ${reading}` : ""}
                          </p>
                        </div>
                        <ChevronRight aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text-main)]" />
                      </Link>
                      {!item.read && (
                        <button
                          type="button"
                          disabled={isUpdating || markingAllRead}
                          onClick={() => handleMarkRead(item.id)}
                          aria-label={`Marcar como leída: ${item.message}`}
                          title="Marcar como leída"
                          className="flex w-11 flex-shrink-0 items-center justify-center border-l border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
                        >
                          {isUpdating ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Check aria-hidden="true" className="h-4 w-4" />}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-[var(--border)] px-4 py-2">
            <Link
              to={alertsPagePath}
              onClick={() => setOpen(false)}
              className="inline-flex min-h-[44px] items-center text-sm font-semibold text-[var(--accent-primary)] hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              {isAdmin ? "Ver todas las alertas" : "Ver mis alertas"}
            </Link>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
