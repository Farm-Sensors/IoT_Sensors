import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, ChartLine, ChevronRight, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartSkeleton } from "../../components/ChartSkeleton";
import { DownloadReadyDialog } from "../../components/DownloadReadyDialog";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { ReadingDateRangeSelector } from "../../components/ReadingDateRangeSelector";
import { SelectionScopeBar } from "../../components/selection/SelectionScopeBar";
import { useSelection } from "../../context/SelectionContext";
import { useTheme } from "../../context/ThemeContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { fetchReadingPage, fetchChartReadings } from "../../services/readings";
import { useReadingFilters } from "../../services/useReadingFilters";
import { readingQuery, type ExportFormat } from "../../utils/readingFilters";
import { aggregateReadingsForChart, MS_IN_DAY } from "../../utils/readingChart";
import { downloadBlobExport } from "../../utils/export";
import { normalizeTimestamp } from "../../utils/datetime";
import type { PaginatedResponse, ReadingResponse } from "../../types/api";

const columns: { label: string; value: (reading: ReadingResponse) => number | boolean | null | undefined }[] = [
  { label: "Humedad Suelo (%)", value: (r) => r.soil?.humidity },
  { label: "Flujo (L/min)", value: (r) => r.irrigation?.flow_per_minute },
  { label: "E.T.O. (mm/día)", value: (r) => r.environmental?.eto },
  { label: "Conductividad (dS/m)", value: (r) => r.soil?.conductivity },
  { label: "Temp. Suelo (°C)", value: (r) => r.soil?.temperature },
  { label: "Potencial hídrico (MPa)", value: (r) => r.soil?.water_potential },
  { label: "Riego activo", value: (r) => r.irrigation?.active },
  { label: "Acumulado (L)", value: (r) => r.irrigation?.accumulated_liters },
  { label: "Temp. Aire (°C)", value: (r) => r.environmental?.temperature },
  { label: "H. Relativa (%)", value: (r) => r.environmental?.relative_humidity },
  { label: "Viento (km/h)", value: (r) => r.environmental?.wind_speed },
  { label: "Radiación solar (W/m²)", value: (r) => r.environmental?.solar_radiation },
];
function displayValue(value: ReturnType<typeof columns[number]["value"]>) {
  if (value == null) return "Sin datos";
  if (typeof value === "boolean") return value ? "Encendido" : "Apagado";
  return value.toFixed(1);
}

type MetricId = "soilHumidity" | "waterFlow" | "eto" | "soilTemp" | "airTemp" | "relativeHumidity";
interface Metric { id: MetricId; label: string; unit: string; decimals: number; zero: boolean; slot: number }
/** Los tres datos prioritarios primero; cada variable conserva siempre su color (orden fijo de la paleta validada). */
const METRICS: Metric[] = [
  { id: "soilHumidity", label: "Humedad del suelo", unit: "%", decimals: 1, zero: false, slot: 0 },
  { id: "waterFlow", label: "Flujo de agua", unit: "L/min", decimals: 1, zero: true, slot: 2 },
  { id: "eto", label: "E.T.O.", unit: "mm/día", decimals: 2, zero: true, slot: 1 },
  { id: "soilTemp", label: "Temp. suelo", unit: "°C", decimals: 1, zero: false, slot: 3 },
  { id: "airTemp", label: "Temp. aire", unit: "°C", decimals: 1, zero: false, slot: 4 },
  { id: "relativeHumidity", label: "H. relativa", unit: "%", decimals: 0, zero: false, slot: 6 },
];
const COLORS_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const COLORS_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

function MetricPicker({ label, value, onChange }: { label: string; value: MetricId; onChange: (id: MetricId) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full flex-wrap gap-0.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-1">
      {METRICS.map((m) => (
        <button key={m.id} type="button" aria-pressed={value === m.id} onClick={() => onChange(m.id)}
          className={`inline-flex min-h-[40px] items-center rounded-[var(--radius)] px-3 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${value === m.id ? "bg-[var(--accent-primary)] font-semibold text-[var(--text-inverted)]" : "font-medium text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--text-main)]"}`}>
          {m.label}
        </button>
      ))}
    </div>
  );
}

/** `embedded`: dentro de Área › Historial, donde el encabezado y el área ya los da el Área. */
export function HistoricalData({ embedded = false }: { embedded?: boolean } = {}) {
  const { selectedArea } = useSelection();
  return <AreaHistory key={selectedArea?.id ?? "none"} embedded={embedded} />;
}

function AreaHistory({ embedded }: { embedded: boolean }) {
  const { selectedArea } = useSelection();
  const isMobile = useIsMobile();

  const filters = useReadingFilters();
  const { startDate, endDate, cycleId, page, setPage } = filters;
  const query = selectedArea ? readingQuery(selectedArea.id, startDate, endDate, cycleId).toString() : "";
  const [retry, setRetry] = useState(0);
  const requestKey = `${query}&page=${page}&retry=${retry}`;
  const chartKey = `${query}&retry=${retry}`;
  const [table, setTable] = useState<{ key: string; data?: PaginatedResponse<ReadingResponse>; error?: string }>();
  const [chart, setChart] = useState<{ key: string; data?: Awaited<ReturnType<typeof fetchChartReadings>>; error?: string }>();
  const currentTable = table?.key === requestKey ? table : undefined;
  const currentChart = chart?.key === chartKey ? chart : undefined;
  const loading = Boolean(query && !currentTable);
  const chartLoading = Boolean(query && !currentChart);
  // Mientras llega la página nueva se siguen mostrando las filas anteriores (atenuadas): si la tabla se vaciara,
  // la página se encogería y el navegador subiría el desplazamiento.
  const shownTable = currentTable?.data ? currentTable : table;
  const readings = shownTable?.data?.data ?? [];
  const chartReadings = currentChart?.data?.readings;
  const totalItems = shownTable?.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / (shownTable?.data?.per_page ?? 20)));
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();
  const [readyFile, setReadyFile] = useState<string | null>(null);

  const { theme } = useTheme();
  const palette = theme === "dark" ? COLORS_DARK : COLORS_LIGHT;
  const [metric, setMetric] = useState<MetricId>("soilHumidity");
  const [recordsOpen, setRecordsOpen] = useState(false);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    fetchReadingPage(query, page, 20, controller.signal).then((data) => {
      if (!controller.signal.aborted) setTable({ key: requestKey, data });
    }).catch(() => {
      if (!controller.signal.aborted) setTable({ key: requestKey, error: "No se pudo cargar el histórico." });
    });
    return () => controller.abort();
  }, [query, page, requestKey]);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    fetchChartReadings(query, controller.signal).then((data) => {
      if (!controller.signal.aborted) setChart({ key: chartKey, data });
    }).catch(() => {
      if (!controller.signal.aborted) setChart({ key: chartKey, error: "No se pudo cargar la gráfica." });
    });
    return () => controller.abort();
  }, [query, chartKey]);

  const daySpan = Math.max(1, differenceInCalendarDays(endDate, startDate));
  const { points: chartData, bucketMs } = useMemo(
    () => aggregateReadingsForChart(chartReadings ?? [], startDate, endDate),
    [chartReadings, startDate, endDate],
  );
  const getXAxisTickLabel = (value: number) => {
    const date = new Date(value);

    if (daySpan <= 1) return format(date, "HH:mm", { locale: es });
    if (bucketMs < MS_IN_DAY) return format(date, "dd MMM HH:mm", { locale: es });
    if (daySpan <= 31) return format(date, "dd MMM", { locale: es });
    return format(date, "dd MMM yy", { locale: es });
  };

  const bucketLabel = bucketMs < 60 * 60_000 ? `${Math.round(bucketMs / 60_000)} min` : bucketMs < MS_IN_DAY ? `${Math.round(bucketMs / 3_600_000)} h` : `${Math.round(bucketMs / MS_IN_DAY)} d`;

  /** Un gráfico de una sola variable y un solo eje; el título dice qué es y su unidad. */
  const renderChart = (id: MetricId) => {
    const m = METRICS.find((x) => x.id === id)!;
    const color = palette[m.slot % palette.length];
    const values = chartData.map((point) => point[id]).filter((v): v is number => v != null && Number.isFinite(v));
    const lo = values.length ? Math.min(...values) : 0;
    const hi = values.length ? Math.max(...values) : 1;
    const pad = Math.max((hi - lo) * 0.1, m.unit === "%" ? 1 : 0.5);
    const domain: [number, number] = m.zero ? [0, Math.ceil((hi + pad) * 10) / 10] : [Math.floor(lo - pad), Math.ceil(hi + pad)];
    const fmt = (v: number) => v.toFixed(m.decimals);
    return (
      <section key={id} aria-label={`Gráfica de ${m.label}`}>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden="true" className="inline-block h-[3px] w-5 rounded-full" style={{ background: color }} />
          {m.label} <span className="font-normal text-[var(--text-muted)]">({m.unit})</span>
        </h3>
        <div className="h-[260px] min-h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="timestampMs" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={getXAxisTickLabel}
                minTickGap={isMobile ? 40 : 56} stroke="var(--text-muted)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <YAxis domain={domain} tickFormatter={m.zero ? fmt : (v: number) => String(Math.round(v))} width={44} allowDecimals={m.zero && m.decimals > 0} stroke="var(--text-muted)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", padding: "8px 12px", fontSize: 12 }}
                labelFormatter={(value) => format(new Date(Number(value)), "dd MMM yyyy, HH:mm", { locale: es })}
                formatter={(value: number) => [`${fmt(value)} ${m.unit}`, m.label] as const}
                labelStyle={{ color: "var(--text-body)", marginBottom: "4px" }}
              />
              <Line type="monotone" dataKey={id} name={`${m.label} (${m.unit})`} stroke={color} strokeWidth={2} dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    );
  };

  const handleExport = async (formatType: ExportFormat) => {
    if (!selectedArea || exporting) return;
    setExporting(true);
    setExportError(undefined);
    try {
      const params = new URLSearchParams(query);
      params.set("format", formatType);
      const fileName = `export_${selectedArea.name}_${format(new Date(), "yyyy-MM-dd")}.${formatType}`;
      await downloadBlobExport(`/readings/export?${params}`, fileName);
      setReadyFile(fileName);
    } catch {
      setExportError("No se pudo exportar. Intenta nuevamente.");
    } finally { setExporting(false); }
  };

  const downloads = (
    <div role="group" aria-label="Descargar resultados" className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-[var(--text-muted)]">Descargar</span>
      {([["csv", "CSV"], ["xlsx", "Excel"], ["pdf", "PDF"]] as const).map(([fmt, name]) => (
        <button key={fmt} type="button" disabled={exporting || !selectedArea} onClick={() => handleExport(fmt)}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--card)] px-3 text-sm font-medium hover:bg-[var(--accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50">
          <Download aria-hidden="true" className="h-4 w-4" />{name}
        </button>
      ))}
    </div>
  );

  return (
    <PageTransition>
    <div className={embedded ? "overflow-x-hidden" : "min-h-screen p-4 md:p-6 lg:p-8 overflow-x-hidden"}>
      {!embedded && (
        <>
          <div className="mb-6 animate-fade-in-up">
            <PageHeader
              title="Datos Históricos"
              subtitle={`Consulta el histórico de lecturas de ${selectedArea ? selectedArea.name : "tus sensores"}`}
            />
          </div>
          <SelectionScopeBar className="mb-6" />
        </>
      )}

      {!selectedArea && <p role="status" className="mb-4 text-[var(--text-body)]">Selecciona un área de riego para consultar sus lecturas.</p>}
      <ReadingDateRangeSelector irrigationAreaId={selectedArea?.id} {...filters} trailing={downloads} />
      {exporting && <p role="status" className="mt-2 text-sm text-[var(--text-muted)]">Preparando la descarga…</p>}
      <DownloadReadyDialog fileName={readyFile} onClose={() => setReadyFile(null)} />
      {exportError && <p role="alert" className="mt-2 text-sm text-[var(--status-danger-text)]">{exportError}</p>}

      <section aria-labelledby="hist-grafica" className="mt-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="hist-grafica" className="text-lg font-semibold">Gráfica</h2>
          <MetricPicker label="Variable de la gráfica" value={metric} onChange={setMetric} />
        </div>

        {currentChart?.data && currentChart.data.readings.length < currentChart.data.total && (
          <p role="status" className="mb-4 flex items-start gap-2 rounded-[var(--radius)] bg-[var(--status-warning-bg)] px-4 py-3 text-sm text-[var(--text-main)]">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--status-warning-text)]" />
            Gráfica parcial: {currentChart.data.readings.length} de {currentChart.data.total} lecturas del rango.
            Reduce el rango para ver más detalle. La tabla y la exportación incluyen todos los resultados.
          </p>
        )}
        {currentChart?.error ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-[var(--text-body)]">
            <span>{currentChart.error}</span>
            <PillButton variant="outline" aria-label="Reintentar gráfica" onClick={() => setRetry((n) => n + 1)}>Reintentar</PillButton>
          </div>
        ) : chartLoading ? (
          <ChartSkeleton title={false} height="sm" />
        ) : chartData.length > 0 ? (
          <div className="space-y-6">
            {renderChart(metric)}
            <p className="border-t border-[var(--border)] pt-3 text-xs text-[var(--text-muted)]">Cada punto es el promedio de {bucketLabel}; los registros exactos están más abajo.</p>
          </div>
        ) : (
          selectedArea ? <EmptyState icon={ChartLine} title="No hay datos para el rango seleccionado" description="Prueba con otro rango o ciclo de cultivo." /> : null
        )}
      </section>

      <details open={recordsOpen} onToggle={(e) => setRecordsOpen(e.currentTarget.open)} className="group mt-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        <summary className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 px-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] md:px-5">
          <h2 className="text-lg font-semibold">
            Ver registros{" "}
            <span className="text-sm font-normal text-[var(--text-muted)]">{totalItems > 0 && `${totalItems} registros — pág. ${page} de ${totalPages}`}</span>
          </h2>
          <ChevronRight aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-90" />
        </summary>
        <div className="border-t border-[var(--border)] p-4 md:p-5">
          {currentTable?.error && (
            <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-[var(--text-body)]">
              <span>{currentTable.error}</span>
              <PillButton variant="outline" aria-label="Reintentar histórico" onClick={() => setRetry((n) => n + 1)}>Reintentar</PillButton>
            </div>
          )}
          {loading && <p role="status" className="sr-only">Cargando lecturas…</p>}
          <p className="mb-2 text-sm text-[var(--text-subtle)] md:hidden">Desliza hacia los lados para ver todas las columnas.</p>
          <div role="region" aria-label="Tabla de lecturas" tabIndex={0} className={`overflow-x-auto transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${loading && readings.length ? "opacity-50" : ""}`} aria-busy={loading}>
            <table className="w-full min-w-[1400px]">
              <caption className="sr-only">Lecturas del rango y ciclo seleccionados</caption>
              <thead>
                <tr className="border-b border-[var(--border-strong)]">
                  <th scope="col" className="sticky left-0 z-10 whitespace-nowrap bg-[var(--card)] px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">Fecha/Hora (local)</th>
                  {columns.map(({ label }) => <th key={label} scope="col" className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">{label}</th>)}
                </tr>
              </thead>
              <tbody className="relative">
                {selectedArea && !loading && !currentTable?.error && readings.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-[var(--text-subtle)]">No hay registros.</td>
                  </tr>
                )}
                {readings.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? "bg-[var(--bg-base)]/60 hover:bg-[var(--accent-soft)]" : "transition-colors hover:bg-[var(--accent-soft)]"}>
                    <td className="sticky left-0 whitespace-nowrap bg-[var(--card)] px-3 py-2 text-sm text-[var(--text-body)]">
                      {format(parseISO(normalizeTimestamp(r.timestamp)), "dd MMM yyyy, HH:mm", { locale: es })}
                    </td>
                    {columns.map(({ label, value }) => <td key={label} className="whitespace-nowrap px-3 py-2 font-mono-data text-sm font-medium text-[var(--text-body)]">{displayValue(value(r))}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav aria-label="Paginación de la tabla" className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <PillButton variant="outline" disabled={page === 1} onClick={() => setPage(1)}>Inicio</PillButton>
              <PillButton variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</PillButton>
              <div className="px-4 text-sm font-medium text-[var(--text-subtle)]">Página {page} de {totalPages}</div>
              <PillButton variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</PillButton>
            </nav>
          )}
        </div>
      </details>
    </div>
    </PageTransition>
  );
}
