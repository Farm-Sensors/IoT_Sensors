import { format, parseISO, startOfDay } from "date-fns";
import { ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

import { Disclosure } from "../../components/Disclosure";
import { PageTransition } from "../../components/PageTransition";
import { ReadingDateRangeSelector } from "../../components/ReadingDateRangeSelector";
import { useOptionalSelection } from "../../context/SelectionContext";
import { useAlertPlaces } from "../../hooks/useAlertPlaces";
import { useModuleStatus } from "../../hooks/useModules";
import { usePageVisibility } from "../../hooks/usePageVisibility";
import { AIReportItem, AIReportStatus, listAIReports } from "../../services/aiReports";
import { describePeriod, REPORT_STATUS, summaryText } from "./reportFormat";

const PAGE_SIZE = 20;

const control =
  "min-h-[44px] rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-panel)] px-3 text-sm text-[var(--text-body)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";
const quietButton =
  "inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius)] border border-[var(--border-strong)] px-3 text-sm font-semibold text-[var(--text-body)] hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Reportes automáticos: resúmenes de un periodo que se generan solos (por cliente y, a veces, por área).
 * Cada fila es un enlace al reporte, con su estado en palabras, el periodo y el inicio del resumen.
 */
export function AIReportsPage() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const selection = useOptionalSelection();
  const { placeOf, clients } = useAlertPlaces(isAdmin);
  const areas = selection?.areas ?? [];
  const properties = selection?.properties ?? [];
  const baseDetailPath = isAdmin ? "/admin/reportes-ia" : "/cliente/reportes-ia";
  const isPageVisible = usePageVisibility();
  const loadingRef = useRef(false);
  // Con el módulo apagado (o aún sin saberlo) no se pide nada: el servidor respondería 503.
  const enabled = useModuleStatus()?.ai_reports === true;

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<AIReportItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const [statusFilter, setStatusFilter] = useState<"" | AIReportStatus>("");
  const [clientId, setClientId] = useState(0);
  const [areaId, setAreaId] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const today = startOfDay(new Date());
  const selectedStartDate = startDate ? startOfDay(parseISO(startDate)) : today;
  const selectedEndDate = endDate ? startOfDay(parseISO(endDate)) : today;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(statusFilter || clientId || areaId || startDate || endDate);

  // Áreas elegibles: las del cliente elegido (admin) o todas las propias (productor), por predio.
  const areaOptions = useMemo(() => {
    const propertyIds = new Set(
      properties.filter((p) => !isAdmin || !clientId || p.client_id === clientId).map((p) => p.id),
    );
    return properties
      .filter((p) => propertyIds.has(p.id))
      .map((p) => ({ property: p.name, areas: areas.filter((a) => a.property_id === p.id) }))
      .filter((group) => group.areas.length > 0);
  }, [properties, areas, clientId, isAdmin]);

  const fetchReports = useCallback(async () => {
    if (!enabled || loadingRef.current) return;
    loadingRef.current = true;
    if (items.length === 0) setLoading(true);
    setErrorMessage(null);

    try {
      const response = await listAIReports({
        page,
        per_page: PAGE_SIZE,
        status: statusFilter || undefined,
        client_id: isAdmin && clientId ? clientId : undefined,
        irrigation_area_id: areaId || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setItems(response.data ?? []);
      setTotal(response.total ?? 0);
      setUpdatedAt(new Date());
    } catch (error) {
      console.error("Failed to fetch AI reports", error);
      setErrorMessage("No fue posible cargar los reportes");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, isAdmin, clientId, startDate, endDate, items.length, areaId, enabled]);

  useEffect(() => {
    setItems([]);
  }, [statusFilter, clientId, startDate, endDate, areaId]);

  useEffect(() => {
    if (!isPageVisible) return;
    fetchReports();
  }, [fetchReports, isPageVisible]);

  const clearFilters = () => {
    setStatusFilter("");
    setClientId(0);
    setAreaId(0);
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const whereOf = (item: AIReportItem): string => {
    if (item.irrigation_area_id) return placeOf(item.irrigation_area_id).where;
    if (!isAdmin) return "Todas tus áreas";
    const name = clients.find((c) => c.id === item.client_id)?.name;
    return name ? `${name} › todas las áreas` : "Todas las áreas del cliente";
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-[1100px] p-4 md:p-8">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-title)] md:text-3xl">Reportes automáticos</h1>
            <p className="mt-1 max-w-xl text-sm text-[var(--text-subtle)]">
              Resúmenes de lo ocurrido en un periodo, generados por el sistema.
              {updatedAt ? ` Actualizado a las ${format(updatedAt, "HH:mm")}.` : ""}
            </p>
          </div>
          <button type="button" onClick={fetchReports} className={quietButton}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Actualizar
          </button>
        </div>

        <div className="mb-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <label className="min-w-[180px] flex-1">
                <span className="sr-only">Cliente</span>
                <select
                  value={clientId}
                  onChange={(event) => {
                    setClientId(Number(event.target.value));
                    setAreaId(0);
                    setPage(1);
                  }}
                  className={`${control} w-full`}
                >
                  <option value={0}>Todos los clientes</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="min-w-[180px] flex-1">
              <span className="sr-only">Área</span>
              <select
                value={areaId}
                onChange={(event) => {
                  setAreaId(Number(event.target.value));
                  setPage(1);
                }}
                className={`${control} w-full`}
              >
                <option value={0}>{isAdmin ? "Todos los reportes" : "Todas mis áreas"}</option>
                {areaOptions.map((group) => (
                  <optgroup key={group.property} label={group.property}>
                    {group.areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div role="group" aria-label="Estado del reporte" className="inline-flex flex-wrap overflow-hidden rounded-[var(--radius)] border border-[var(--border-strong)]">
              {([["", "Todos"], ["completed", "Listos"], ["processing", "Generándose"], ["failed", "Con error"]] as Array<["" | AIReportStatus, string]>).map(([value, label]) => (
                <button
                  key={value || "all"}
                  type="button"
                  aria-pressed={statusFilter === value}
                  onClick={() => {
                    setStatusFilter(value);
                    setPage(1);
                  }}
                  className={`min-h-[44px] px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] ${
                    statusFilter === value ? "bg-[var(--accent-soft)] font-semibold text-[var(--text-main)]" : "text-[var(--text-muted)] hover:bg-[var(--hover-overlay)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Disclosure summary={startDate || endDate ? "Fechas (filtradas)" : "Fechas"} defaultOpen={Boolean(startDate || endDate)} className="mt-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-sm text-[var(--text-subtle)]">Periodo {startDate || endDate ? "" : "(todos)"}</span>
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
          </Disclosure>
        </div>

        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-12 text-[var(--text-subtle)]">
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
            Cargando reportes…
          </div>
        ) : errorMessage ? (
          <div role="alert" className="rounded-[var(--radius)] border border-[var(--status-danger-text)]/30 bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-text)]">
            {errorMessage}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-10 text-center">
            {hasFilters ? (
              <>
                <p className="text-base font-semibold text-[var(--text-main)]">Ningún reporte coincide con el filtro</p>
                <button type="button" onClick={clearFilters} className={`${quietButton} mt-3`}>
                  Limpiar filtros
                </button>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-[var(--text-main)]">Aún no hay reportes</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-muted)]">
                  El sistema los genera por su cuenta; cuando haya uno, aparecerá aquí.
                </p>
              </>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const meta = REPORT_STATUS[item.status];
              const Icon = meta.icon;
              return (
                <li key={item.id}>
                  <Link
                    to={`${baseDetailPath}/${item.id}`}
                    className="group flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-3 hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] md:px-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${meta.bg} ${meta.text}`}>
                          <Icon aria-hidden="true" className={`h-3.5 w-3.5 ${meta.spin ? "animate-spin" : ""}`} />
                          {meta.label}
                        </span>
                        <span className="font-semibold text-[var(--text-main)]">{describePeriod(item.range_start, item.range_end)}</span>
                      </div>
                      <p className="text-sm text-[var(--text-muted)]">{whereOf(item)}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--text-body)]">{summaryText(item)}</p>
                    </div>
                    <ChevronRight aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text-main)]" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {total > PAGE_SIZE && (
          <nav aria-label="Páginas de reportes" className="mt-5 flex items-center justify-between gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className={quietButton}>
              Anterior
            </button>
            <span className="text-sm text-[var(--text-subtle)]">
              Página {page} de {totalPages} · {total} reportes
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
