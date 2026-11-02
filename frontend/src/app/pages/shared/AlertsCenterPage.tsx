import { format, formatDistanceToNowStrict, parseISO, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Check, CheckCheck, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";

import { Disclosure } from "../../components/Disclosure";
import { PageTransition } from "../../components/PageTransition";
import { ReadingDateRangeSelector } from "../../components/ReadingDateRangeSelector";
import { useOptionalSelection } from "../../context/SelectionContext";
import { usePageVisibility } from "../../hooks/usePageVisibility";
import {
  AlertItem,
  getUnreadAlertsCount,
  listAlerts,
  markAlertRead,
  markAllAlertsRead,
} from "../../services/alerts";
import { api } from "../../services/api";
import { parseBackendTimestamp } from "../../utils/datetime";
import { describeReading, SEVERITY_META, TYPE_LABEL } from "./alertFormat";

type ReadFilter = "all" | "read" | "unread";

const PAGE_SIZE = 20;
const LIVE_REFRESH_INTERVAL_MS = 30000;

const control =
  "min-h-[44px] rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-panel)] px-3 text-sm text-[var(--text-body)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";
const quietButton =
  "inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius)] border border-[var(--border-strong)] px-3 text-sm font-semibold text-[var(--text-body)] hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50";

function formatRelativeDate(iso: string): string {
  const parsed = parseBackendTimestamp(iso);
  if (!parsed) return iso;
  return formatDistanceToNowStrict(parsed, { addSuffix: true, locale: es });
}

/**
 * Lista de alertas (admin: «Todas las alertas», productor: «Mis alertas»). Cada fila es un enlace al detalle:
 * gravedad con icono y texto, dónde (cliente › predio › área), la medición con su unidad y cuándo.
 */
export function AlertsCenterPage() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const [searchParams] = useSearchParams();
  const selection = useOptionalSelection();
  const isPageVisible = usePageVisibility();
  const loadingRef = useRef(false);
  const knownAlertIdsRef = useRef<Set<number>>(new Set());
  const animationTimeoutsRef = useRef<number[]>([]);

  const [areaId, setAreaId] = useState<number>(() => Number(searchParams.get("area")) || 0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<AlertItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [animatedIds, setAnimatedIds] = useState<Set<number>>(new Set());
  const [clientNames, setClientNames] = useState<Map<number, string>>(new Map());

  const [severity, setSeverity] = useState<"" | AlertItem["severity"]>("");
  const [alertType, setAlertType] = useState<"" | AlertItem["type"]>("");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const today = startOfDay(new Date());
  const selectedStartDate = startDate ? startOfDay(parseISO(startDate)) : today;
  const selectedEndDate = endDate ? startOfDay(parseISO(endDate)) : today;
  const alertDetailBasePath = isAdmin ? "/admin/alertas" : "/cliente/alertas";
  const thresholdsPath = isAdmin ? "/admin/umbrales" : "/cliente/umbrales";
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const scopedAreaId = areaId || undefined;

  // Nombres: predio y área salen de lo que la app ya carga; el cliente, de una consulta (solo admin).
  const areas = selection?.areas ?? [];
  const properties = selection?.properties ?? [];
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    api
      .get("/clients", { params: { per_page: 100 } })
      .then((response) => {
        if (cancelled) return;
        const list: Array<{ id: number; company_name: string }> = response.data?.data ?? [];
        setClientNames(new Map(list.map((c) => [c.id, c.company_name])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const placeOf = useCallback(
    (alertAreaId: number): { where: string } => {
      const area = areas.find((a) => a.id === alertAreaId);
      if (!area) return { where: `Área ${alertAreaId}` };
      const property = properties.find((p) => p.id === area.property_id);
      const client = isAdmin && property ? clientNames.get(property.client_id) : undefined;
      return { where: [client, property?.name, area.name].filter(Boolean).join(" › ") };
    },
    [areas, properties, clientNames, isAdmin],
  );

  const activeFilterCount = [alertType, startDate || endDate].filter(Boolean).length;
  const hasFilters = Boolean(areaId || severity || alertType || readFilter !== "all" || startDate || endDate);

  const fetchAlerts = useCallback(
    async (options?: { silent?: boolean; animateNew?: boolean }) => {
      const silent = options?.silent === true;
      const animateNew = options?.animateNew === true;
      if (loadingRef.current) return;
      loadingRef.current = true;
      if (!silent) {
        setLoading(true);
        setErrorMessage(null);
      }

      const scope = {
        irrigation_area_id: scopedAreaId,
        severity: severity || undefined,
        alert_type: alertType || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      };

      try {
        const [response, unread] = await Promise.all([
          listAlerts({
            page,
            per_page: PAGE_SIZE,
            ...scope,
            read: readFilter === "all" ? undefined : readFilter === "read",
          }),
          getUnreadAlertsCount(scope).catch(() => null),
        ]);

        const nextItems = response.data ?? [];
        if (animateNew) {
          const knownIds = knownAlertIdsRef.current;
          if (knownIds.size > 0) {
            const newIds = nextItems.map((item) => item.id).filter((id) => !knownIds.has(id));
            if (newIds.length > 0) {
              setAnimatedIds((previous) => {
                const next = new Set(previous);
                for (const id of newIds) next.add(id);
                return next;
              });
              const timeoutId = window.setTimeout(() => {
                setAnimatedIds((previous) => {
                  const next = new Set(previous);
                  for (const id of newIds) next.delete(id);
                  return next;
                });
              }, 650);
              animationTimeoutsRef.current.push(timeoutId);
            }
          }
        } else {
          setAnimatedIds(new Set());
        }

        knownAlertIdsRef.current = new Set(nextItems.map((item) => item.id));
        setItems(nextItems);
        setTotal(response.total ?? 0);
        if (unread !== null) setUnreadTotal(unread);
        setUpdatedAt(new Date());
      } catch (error) {
        console.error("Failed to fetch alerts", error);
        if (!silent) {
          setErrorMessage("No fue posible cargar las alertas");
        }
      } finally {
        loadingRef.current = false;
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [page, severity, alertType, readFilter, startDate, endDate, scopedAreaId],
  );

  useEffect(() => {
    return () => {
      for (const timeoutId of animationTimeoutsRef.current) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    if (!isPageVisible) return;
    fetchAlerts();
  }, [fetchAlerts, isPageVisible]);

  useEffect(() => {
    if (!isPageVisible) return;
    const intervalId = window.setInterval(() => {
      void fetchAlerts({ silent: true, animateNew: true });
    }, LIVE_REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchAlerts, isPageVisible]);

  const markAsRead = async (alertId: number) => {
    setUpdatingIds((previous) => new Set(previous).add(alertId));
    try {
      await markAlertRead(alertId, true);
      setItems((previous) =>
        previous.map((item) =>
          item.id === alertId ? { ...item, read: true, read_at: new Date().toISOString() } : item,
        ),
      );
      setUnreadTotal((count) => Math.max(0, count - 1));
    } catch (error) {
      console.error("Failed to mark alert as read", error);
      setErrorMessage("No fue posible marcar la alerta como leída");
    } finally {
      setUpdatingIds((previous) => {
        const next = new Set(previous);
        next.delete(alertId);
        return next;
      });
    }
  };

  const markAllAsRead = async () => {
    setMarkingAllRead(true);
    setErrorMessage(null);
    try {
      await markAllAlertsRead({
        irrigation_area_id: scopedAreaId,
        severity: severity || undefined,
        alert_type: alertType || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      await fetchAlerts();
    } catch (error) {
      console.error("Failed to mark all alerts as read", error);
      setErrorMessage("No fue posible marcar todas las alertas como leídas");
    } finally {
      setMarkingAllRead(false);
    }
  };

  const clearFilters = () => {
    setAreaId(0);
    setSeverity("");
    setAlertType("");
    setReadFilter("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const unreadItems = useMemo(() => items.filter((item) => !item.read), [items]);
  const readItems = useMemo(() => items.filter((item) => item.read), [items]);
  const propertyById = new Map(properties.map((p) => [p.id, p.name]));

  const renderRow = (item: AlertItem) => {
    const meta = SEVERITY_META[item.severity];
    const Icon = meta.icon;
    // El mensaje del servidor ya trae el valor; la medición con unidad solo se añade si no lo trae.
    const reading = item.detected_value !== null && item.message.includes(String(item.detected_value)) ? null : describeReading(item);
    const isUpdating = updatingIds.has(item.id);
    return (
      <li
        key={item.id}
        className={`flex items-stretch overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] ${
          animatedIds.has(item.id) ? "animate-fade-in-down" : ""
        }`}
      >
        <span aria-hidden="true" className={`w-1 flex-shrink-0 ${meta.bar}`} />
        <Link
          to={`${alertDetailBasePath}/${item.id}`}
          className="group flex min-w-0 flex-1 items-center gap-3 px-3 py-3 hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] md:px-4"
        >
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${meta.bg} ${meta.text}`}>
                <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                {meta.label}
              </span>
              <span className="text-[var(--text-muted)]">{TYPE_LABEL[item.type]}</span>
              <span className="ml-auto text-[var(--text-muted)] md:hidden">{formatRelativeDate(item.timestamp)}</span>
            </div>
            <p className={`text-[15px] text-[var(--text-main)] ${item.read ? "" : "font-semibold"}`}>{item.message}</p>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              {placeOf(item.irrigation_area_id).where}
              {reading ? <span className="font-mono-data"> · {reading}</span> : null}
            </p>
          </div>
          <span className="hidden flex-shrink-0 text-right text-xs text-[var(--text-muted)] md:block">{formatRelativeDate(item.timestamp)}</span>
          <ChevronRight aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text-main)]" />
        </Link>
        {!item.read && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => markAsRead(item.id)}
            aria-label={`Marcar como leída: ${item.message}`}
            title="Marcar como leída"
            className="flex w-12 flex-shrink-0 items-center justify-center border-l border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
          >
            {isUpdating ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Check aria-hidden="true" className="h-4 w-4" />}
          </button>
        )}
      </li>
    );
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-[1100px] p-4 md:p-8">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-title)] md:text-3xl">{isAdmin ? "Todas las alertas" : "Mis alertas"}</h1>
            <p className="mt-1 text-sm text-[var(--text-subtle)]">
              {unreadTotal > 0 ? (
                <span className="font-semibold text-[var(--text-main)]">{unreadTotal === 1 ? "1 sin leer" : `${unreadTotal} sin leer`}</span>
              ) : (
                "Todo leído"
              )}
              {updatedAt ? ` · Actualizado a las ${format(updatedAt, "HH:mm")}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={markAllAsRead} disabled={markingAllRead || unreadTotal === 0} className={quietButton}>
              {markingAllRead ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <CheckCheck aria-hidden="true" className="h-4 w-4" />}
              Marcar todas como leídas
            </button>
            <button type="button" onClick={() => fetchAlerts()} className={quietButton}>
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Actualizar
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="min-w-[200px] flex-1">
              <span className="sr-only">Área</span>
              <select
                value={areaId}
                onChange={(event) => {
                  setAreaId(Number(event.target.value));
                  setPage(1);
                }}
                className={`${control} w-full`}
              >
                <option value={0}>Todas las áreas</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {propertyById.get(area.property_id) ? `${propertyById.get(area.property_id)} › ${area.name}` : area.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Gravedad</span>
              <select
                value={severity}
                onChange={(event) => {
                  setSeverity(event.target.value as "" | AlertItem["severity"]);
                  setPage(1);
                }}
                className={control}
              >
                <option value="">Toda gravedad</option>
                <option value="critical">Crítica</option>
                <option value="warning">Aviso</option>
                <option value="info">Información</option>
              </select>
            </label>
            <div role="group" aria-label="Estado de lectura" className="inline-flex overflow-hidden rounded-[var(--radius)] border border-[var(--border-strong)]">
              {([["all", "Todas"], ["unread", "Sin leer"], ["read", "Leídas"]] as Array<[ReadFilter, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={readFilter === value}
                  onClick={() => {
                    setReadFilter(value);
                    setPage(1);
                  }}
                  className={`min-h-[44px] px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] ${
                    readFilter === value ? "bg-[var(--accent-soft)] font-semibold text-[var(--text-main)]" : "text-[var(--text-muted)] hover:bg-[var(--hover-overlay)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Disclosure summary={activeFilterCount > 0 ? `Más filtros (${activeFilterCount})` : "Más filtros"} defaultOpen={activeFilterCount > 0} className="mt-1">
            <div className="grid gap-3 md:grid-cols-[220px_1fr]">
              <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
                Tipo
                <select
                  value={alertType}
                  onChange={(event) => {
                    setAlertType(event.target.value as "" | AlertItem["type"]);
                    setPage(1);
                  }}
                  className={control}
                >
                  <option value="">Todos</option>
                  <option value="threshold">Umbral</option>
                  <option value="inactivity">Sin datos</option>
                </select>
              </label>
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm text-[var(--text-subtle)]">Fechas {startDate || endDate ? "" : "(todas)"}</span>
                  {(startDate || endDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate("");
                        setEndDate("");
                        setPage(1);
                      }}
                      className="min-h-[44px] px-2 text-sm font-medium text-[var(--accent-primary)] hover:opacity-80"
                    >
                      Quitar fechas
                    </button>
                  )}
                </div>
                <ReadingDateRangeSelector
                  variant="soft"
                  startDate={selectedStartDate}
                  endDate={selectedEndDate}
                  onStartDateChange={(nextDate) => {
                    const normalized = startOfDay(nextDate);
                    setStartDate(format(normalized, "yyyy-MM-dd"));
                    if (endDate && normalized > startOfDay(parseISO(endDate))) {
                      setEndDate(format(normalized, "yyyy-MM-dd"));
                    }
                    setPage(1);
                  }}
                  onEndDateChange={(nextDate) => {
                    const normalized = startOfDay(nextDate);
                    setEndDate(format(normalized, "yyyy-MM-dd"));
                    if (startDate && normalized < startOfDay(parseISO(startDate))) {
                      setStartDate(format(normalized, "yyyy-MM-dd"));
                    }
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </Disclosure>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[var(--text-subtle)]" role="status">
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
            Cargando alertas…
          </div>
        ) : errorMessage ? (
          <div role="alert" className="rounded-[var(--radius)] border border-[var(--status-danger-text)]/30 bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-text)]">
            {errorMessage}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-10 text-center">
            {hasFilters ? (
              <>
                <p className="text-base font-semibold text-[var(--text-main)]">Ninguna alerta coincide con el filtro</p>
                <button type="button" onClick={clearFilters} className={`${quietButton} mt-3`}>
                  Limpiar filtros
                </button>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-[var(--text-main)]">Aún no hay alertas</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-muted)]">
                  Aparecen cuando una medición sale de sus umbrales o un nodo deja de enviar datos.
                </p>
                <Link to={thresholdsPath} className={`${quietButton} mt-3`}>
                  Ver los umbrales
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {unreadItems.length > 0 && (
              <section aria-labelledby="alertas-sin-leer">
                <h2 id="alertas-sin-leer" className="mb-2 text-sm font-semibold text-[var(--text-main)]">
                  Sin leer <span className="font-normal text-[var(--text-muted)]">· {unreadItems.length}</span>
                </h2>
                <ul className="space-y-2">{unreadItems.map(renderRow)}</ul>
              </section>
            )}
            {readItems.length > 0 && (
              <section aria-labelledby="alertas-leidas">
                <h2 id="alertas-leidas" className="mb-2 text-sm font-semibold text-[var(--text-main)]">
                  Leídas <span className="font-normal text-[var(--text-muted)]">· {readItems.length}</span>
                </h2>
                <ul className="space-y-2">{readItems.map(renderRow)}</ul>
              </section>
            )}
          </div>
        )}

        {total > PAGE_SIZE && (
          <nav aria-label="Páginas de alertas" className="mt-5 flex items-center justify-between gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className={quietButton}>
              Anterior
            </button>
            <span className="text-sm text-[var(--text-subtle)]">
              Página {page} de {totalPages} · {total} alertas
            </span>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className={quietButton}>
              Siguiente
            </button>
          </nav>
        )}
      </div>
    </PageTransition>
  );
}
