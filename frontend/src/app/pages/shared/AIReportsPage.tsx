import { format, parseISO, startOfDay, subDays } from "date-fns";
import {
  Bot,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

import { BentoCard } from "../../components/BentoCard";
import { PageTransition } from "../../components/PageTransition";
import { ReadingDateRangeSelector } from "../../components/ReadingDateRangeSelector";
import { SelectionScopeBar } from "../../components/selection/SelectionScopeBar";
import { useOptionalSelection } from "../../context/SelectionContext";
import { usePageVisibility } from "../../hooks/usePageVisibility";
import { AIReportItem, AIReportStatus, listAIReports } from "../../services/aiReports";

const PAGE_SIZE = 20;

const statusStyles: Record<AIReportStatus, string> = {
  pending: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  processing: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  completed: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
  failed: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
};

const statusLabels: Record<AIReportStatus, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  completed: "Completado",
  failed: "Fallido",
};

function shortDate(isoValue: string): string {
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return isoValue;
  return format(parsed, "dd/MM/yyyy HH:mm");
}

function summaryFallback(item: AIReportItem): string {
  if (item.summary?.trim()) return item.summary;
  if (item.status === "failed") return item.error_detail || "El reporte falló en la generación.";
  if (item.status === "processing") return "El reporte está en proceso de generación.";
  return "Reporte sin resumen disponible.";
}

export function AIReportsPage() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const selection = useOptionalSelection();
  const scopedAreaId = selection?.selectedArea?.id;
  const baseDetailPath = isAdmin ? "/admin/reportes-ia" : "/cliente/reportes-ia";
  const isPageVisible = usePageVisibility();
  const loadingRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<AIReportItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] = useState<"" | AIReportStatus>("");
  const [clientIdFilter, setClientIdFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fallbackStartDate = startOfDay(subDays(new Date(), 7));
  const fallbackEndDate = startOfDay(new Date());
  const selectedStartDate = startDate ? startOfDay(parseISO(startDate)) : fallbackStartDate;
  const selectedEndDate = endDate ? startOfDay(parseISO(endDate)) : fallbackEndDate;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const completedOnPage = useMemo(
    () => items.filter((item) => item.status === "completed").length,
    [items],
  );

  const fetchReports = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (items.length === 0) setLoading(true);
    setErrorMessage(null);

    try {
      const response = await listAIReports({
        page,
        per_page: PAGE_SIZE,
        status: statusFilter || undefined,
        client_id: isAdmin && clientIdFilter ? Number(clientIdFilter) : undefined,
        irrigation_area_id: scopedAreaId || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setItems(response.data ?? []);
      setTotal(response.total ?? 0);
    } catch (error) {
      console.error("Failed to fetch AI reports", error);
      setErrorMessage("No fue posible cargar los reportes IA");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [page, statusFilter, isAdmin, clientIdFilter, startDate, endDate, items.length, scopedAreaId]);

  useEffect(() => {
    setItems([]);
  }, [statusFilter, clientIdFilter, startDate, endDate, scopedAreaId]);

  useEffect(() => {
    if (!isPageVisible) return;
    fetchReports();
  }, [fetchReports, isPageVisible]);

  const goToPreviousPage = () => {
    setPage((previous) => Math.max(1, previous - 1));
  };

  const goToNextPage = () => {
    setPage((previous) => Math.min(totalPages, previous + 1));
  };

  return (
    <PageTransition>
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-title)]">
              Reportes automáticos
            </h1>
            <p className="text-[var(--text-subtle)]">
              {isAdmin
                ? "Vista global de reportes generados por cliente y área."
                : "Resumen diario de hallazgos y recomendaciones de tus áreas."}
            </p>
          </div>

          <button
            type="button"
            onClick={fetchReports}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-4 py-2 text-sm font-medium text-[var(--text-body)] hover:bg-[var(--hover-overlay)]"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>
        <SelectionScopeBar className="mb-4" />

        <BentoCard variant="light" className="mb-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
              Estado
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as "" | AIReportStatus);
                  setPage(1);
                }}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2 text-[var(--text-body)]"
              >
                <option value="">Todos</option>
                <option value="pending">Pendiente</option>
                <option value="processing">Procesando</option>
                <option value="completed">Completado</option>
                <option value="failed">Fallido</option>
              </select>
            </label>

            {isAdmin ? (
              <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
                Cliente ID
                <input
                  type="number"
                  min={1}
                  value={clientIdFilter}
                  onChange={(event) => {
                    setClientIdFilter(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Todos"
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2 text-[var(--text-body)]"
                />
              </label>
            ) : (
              <div className="hidden md:block" />
            )}

            <div className="md:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-[var(--text-subtle)]">Rango de fechas</span>
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                      setPage(1);
                    }}
                    className="text-xs font-medium text-[var(--accent-primary)] hover:opacity-80"
                  >
                    Limpiar
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
        </BentoCard>

        <BentoCard variant="light">
          <div className="mb-4 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-sm text-[var(--text-subtle)]">
              <Bot className="h-4 w-4" />
              {total} reportes · {completedOnPage} completados en esta página
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goToPreviousPage}
                disabled={page <= 1}
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-2 text-[var(--text-body)] disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-[var(--text-subtle)]">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                onClick={goToNextPage}
                disabled={page >= totalPages}
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-2 text-[var(--text-body)] disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-[var(--text-subtle)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando reportes IA...
            </div>
          ) : errorMessage ? (
            <div className="rounded-xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-text)]">
              {errorMessage}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-6 text-center text-sm text-[var(--text-subtle)]">
              No hay reportes IA para los filtros seleccionados.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <Link
                  key={item.id}
                  to={`${baseDetailPath}/${item.id}`}
                  className="block rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-3 transition-colors hover:bg-[var(--hover-overlay)]"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="inline-flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyles[item.status]}`}
                      >
                        {statusLabels[item.status]}
                      </span>
                      <span className="rounded-full bg-[var(--surface-card-secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-body)]">
                        Reporte #{item.id}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs text-[var(--text-subtle)]">
                      <CalendarRange className="h-3.5 w-3.5" />
                      {shortDate(item.range_start)} - {shortDate(item.range_end)}
                    </span>
                  </div>

                  <p className="line-clamp-2 text-sm text-[var(--text-body)]">
                    {summaryFallback(item)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </BentoCard>
      </div>
    </PageTransition>
  );
}
