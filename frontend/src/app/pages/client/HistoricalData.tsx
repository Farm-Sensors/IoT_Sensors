import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Check, ChartLine, Download, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BentoCard } from "../../components/BentoCard";
import { ChartSkeleton } from "../../components/ChartSkeleton";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { ReadingDateRangeSelector } from "../../components/ReadingDateRangeSelector";
import { SelectionScopeBar } from "../../components/selection/SelectionScopeBar";
import { useSelection } from "../../context/SelectionContext";
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

function SeriesToggle({ active, color, onToggle, children }: { active: boolean; color: string; onToggle: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2
        ${active
          ? "border-2 bg-[var(--surface-card-primary)] text-[var(--text-main)]"
          : "border border-[var(--border-strong)] text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)]"}`}
      style={active ? { borderColor: color } : undefined}
    >
      <span aria-hidden="true" className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: active ? color : "transparent", border: `2px solid ${color}` }} />
      {children}
      {active && <Check aria-hidden="true" className="h-4 w-4" />}
    </button>
  );
}

export function HistoricalData() {
  const { selectedArea } = useSelection();
  return <AreaHistory key={selectedArea?.id ?? "none"} />;
}

function AreaHistory() {
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
  const readings = currentTable?.data?.data ?? [];
  const chartReadings = currentChart?.data?.readings;
  const totalItems = currentTable?.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / (currentTable?.data?.per_page ?? 20)));
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();

  const [soilEnvSeries, setSoilEnvSeries] = useState({
    soilHumidity: true,
    relativeHumidity: true,
    soilTemp: true,
    airTemp: true,
  });

  const [irrigationSeries, setIrrigationSeries] = useState({
    waterFlow: true,
    eto: true,
  });

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

  const getLineValueFormatter = (value: number, lineName: string) => {
    if (lineName.includes("(%)")) return [`${value.toFixed(1)} %`, lineName] as const;
    if (lineName.includes("(°C)")) return [`${value.toFixed(1)} °C`, lineName] as const;
    if (lineName.includes("(L/min)")) return [`${value.toFixed(1)} L/min`, lineName] as const;
    if (lineName.includes("(mm/día)")) return [`${value.toFixed(2)} mm/día`, lineName] as const;
    return [value.toFixed(1), lineName] as const;
  };

  const toggleSoilEnvSeries = (key: keyof typeof soilEnvSeries) => {
    setSoilEnvSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleIrrigationSeries = (key: keyof typeof irrigationSeries) => {
    setIrrigationSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const soilEnvTempDomain = useMemo<[number, number]>(() => {
    const values = chartData
      .flatMap((point) => [point.soilTemp, point.airTemp])
      .filter((value): value is number => value != null && Number.isFinite(value));

    if (values.length === 0) {
      return [0, 40];
    }

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const span = maxValue - minValue;
    const padding = span === 0 ? Math.max(1, Math.abs(maxValue) * 0.05) : Math.max(0.5, span * 0.1);

    const domainMin = Number((minValue - padding).toFixed(1));
    const domainMax = Number((maxValue + padding).toFixed(1));

    return [domainMin, domainMax];
  }, [chartData]);

  const showSoilEnvPercentAxis = soilEnvSeries.soilHumidity || soilEnvSeries.relativeHumidity;
  const showSoilEnvTempAxis = soilEnvSeries.soilTemp || soilEnvSeries.airTemp;
  const showIrrigationFlowAxis = irrigationSeries.waterFlow;
  const showIrrigationEtoAxis = irrigationSeries.eto;

  const handleExport = async (formatType: ExportFormat) => {
    if (!selectedArea || exporting) return;
    setExporting(true);
    setExportError(undefined);
    try {
      const params = new URLSearchParams(query);
      params.set("format", formatType);
      await downloadBlobExport(`/readings/export?${params}`, `export_${selectedArea.name}_${format(new Date(), "yyyy-MM-dd")}.${formatType}`);
    } catch {
      setExportError("No se pudo exportar. Intenta nuevamente.");
    } finally { setExporting(false); }
  };

  return (
    <PageTransition>
    <div className="min-h-screen p-4 md:p-6 lg:p-8 overflow-x-hidden">
      <div className="mb-6 animate-fade-in-up">
        <PageHeader
          title="Datos Históricos"
          subtitle={`Consulta el histórico de lecturas de ${selectedArea ? selectedArea.name : "tus sensores"}`}
        />
      </div>
      <SelectionScopeBar className="mb-6" />

      {!selectedArea && <p role="status" className="mb-4 text-[var(--text-body)]">Selecciona un área de riego para consultar sus lecturas.</p>}
      <BentoCard variant="light" className="mb-6">
        <ReadingDateRangeSelector irrigationAreaId={selectedArea?.id} {...filters} />
      </BentoCard>

      {/* Multi-line Chart */}
      <BentoCard variant="light" className="mb-6">
        <h2 className="text-lg text-[var(--text-title)] mb-2">Gráfica de Métricas</h2>
        <p className="mb-4 text-sm text-[var(--text-subtle)]">Las horas de la gráfica y la tabla se muestran en tu zona horaria local.</p>

        {currentChart?.data && currentChart.data.readings.length < currentChart.data.total && (
          <p role="status" className="mb-4 flex items-start gap-2 rounded-2xl bg-[var(--status-warning-bg)] px-4 py-3 text-sm text-[var(--text-main)]">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--status-warning)]" />
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
          <div className="space-y-10 lg:space-y-12">
            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-4 md:p-5">
              <div className="space-y-3">
                <h3 className="text-base font-medium text-[var(--text-body)]">Suelo + Ambiental (Temperaturas y Humedades)</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <SeriesToggle active={soilEnvSeries.soilHumidity} color="var(--accent-primary)" onToggle={() => toggleSoilEnvSeries("soilHumidity")}>Humedad suelo</SeriesToggle>
                  <SeriesToggle active={soilEnvSeries.relativeHumidity} color="var(--accent-gold)" onToggle={() => toggleSoilEnvSeries("relativeHumidity")}>H. Relativa</SeriesToggle>
                  <SeriesToggle active={soilEnvSeries.soilTemp} color="var(--chart-4)" onToggle={() => toggleSoilEnvSeries("soilTemp")}>Temp. suelo</SeriesToggle>
                  <SeriesToggle active={soilEnvSeries.airTemp} color="var(--chart-3)" onToggle={() => toggleSoilEnvSeries("airTemp")}>Temp. aire</SeriesToggle>
                </div>

                <div className="relative h-[320px] min-h-[320px]">
                  {chartLoading && (
                    <div className="absolute inset-0 z-10 bg-[var(--surface-page)]/60 flex items-center justify-center backdrop-blur-[1px]">
                      <Loader2 className="w-8 h-8 text-[var(--accent-primary)] animate-spin" />
                    </div>
                  )}

                  <ResponsiveContainer width="100%" height="100%" className="animate-chart-entrance">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong)" />
                      <XAxis
                        dataKey="timestampMs"
                        type="number"
                        scale="time"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={getXAxisTickLabel}
                        minTickGap={isMobile ? 36 : 24}
                        stroke="var(--text-subtle)"
                        style={{ fontSize: '12px' }}
                      />
                      {showSoilEnvPercentAxis && (
                        <YAxis
                          key="soil-env-axis-percent"
                          yAxisId="percent"
                          domain={[0, 100]}
                          tickFormatter={(v) => `${v}%`}
                          stroke="var(--text-subtle)"
                          style={{ fontSize: '12px' }}
                        />
                      )}
                      {showSoilEnvTempAxis && (
                        <YAxis
                          key="soil-env-axis-temp"
                          yAxisId="temp"
                          orientation="right"
                          domain={soilEnvTempDomain}
                          tickFormatter={(v) => `${v}°C`}
                          stroke="var(--chart-4)"
                          style={{ fontSize: '12px' }}
                        />
                      )}
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--bg-elevated)",
                          border: "1px solid var(--border-strong)",
                          borderRadius: '16px',
                          padding: '12px'
                        }}
                        labelFormatter={(value) =>
                          format(new Date(Number(value)), "dd MMM yyyy, HH:mm", { locale: es })
                        }
                        formatter={(value: number, name: string) => getLineValueFormatter(value, name)}
                        labelStyle={{ color: "var(--text-body)", marginBottom: "4px" }}
                      />
                      <Legend formatter={(value) => <span style={{ color: "var(--text-body)" }}>{value}</span>} />
                      {soilEnvSeries.soilHumidity && (
                        <Line key="soil-env-line-soil-humidity" animationId={1101} yAxisId="percent" type="monotone" dataKey="soilHumidity" name="Humedad suelo (%)" stroke="var(--accent-primary)" strokeWidth={2.5} dot={false} />
                      )}
                      {soilEnvSeries.relativeHumidity && (
                        <Line key="soil-env-line-relative-humidity" animationId={1102} yAxisId="percent" type="monotone" dataKey="relativeHumidity" name="H. Relativa (%)" stroke="var(--accent-gold)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                      )}
                      {soilEnvSeries.soilTemp && (
                        <Line key="soil-env-line-soil-temp" animationId={1103} yAxisId="temp" type="monotone" dataKey="soilTemp" name="Temp. suelo (°C)" stroke="var(--chart-4)" strokeWidth={2.2} dot={false} />
                      )}
                      {soilEnvSeries.airTemp && (
                        <Line key="soil-env-line-air-temp" animationId={1104} yAxisId="temp" type="monotone" dataKey="airTemp" name="Temp. aire (°C)" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-4 md:p-5">
              <div className="space-y-3">
                <h3 className="text-base font-medium text-[var(--text-body)]">Riego + E.T.O.</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <SeriesToggle active={irrigationSeries.waterFlow} color="var(--accent-gold)" onToggle={() => toggleIrrigationSeries("waterFlow")}>Flujo de agua</SeriesToggle>
                  <SeriesToggle active={irrigationSeries.eto} color="var(--accent-primary)" onToggle={() => toggleIrrigationSeries("eto")}>E.T.O.</SeriesToggle>
                </div>

                <div className="relative h-[320px] min-h-[320px]">
                  {chartLoading && (
                    <div className="absolute inset-0 z-10 bg-[var(--surface-page)]/60 flex items-center justify-center backdrop-blur-[1px]">
                      <Loader2 className="w-8 h-8 text-[var(--accent-primary)] animate-spin" />
                    </div>
                  )}

                  <ResponsiveContainer width="100%" height="100%" className="animate-chart-entrance">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong)" />
                      <XAxis
                        dataKey="timestampMs"
                        type="number"
                        scale="time"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={getXAxisTickLabel}
                        minTickGap={isMobile ? 36 : 24}
                        stroke="var(--text-subtle)"
                        style={{ fontSize: '12px' }}
                      />
                      {showIrrigationFlowAxis && (
                        <YAxis
                          key="irrigation-axis-flow"
                          yAxisId="flow"
                          domain={[0, "dataMax + 2"]}
                          tickFormatter={(v) => `${v} L/min`}
                          stroke="var(--accent-gold)"
                          style={{ fontSize: '12px' }}
                        />
                      )}
                      {showIrrigationEtoAxis && (
                        <YAxis
                          key="irrigation-axis-eto"
                          yAxisId="eto"
                          orientation="right"
                          domain={[0, "dataMax + 1"]}
                          tickFormatter={(v) => `${v} mm/día`}
                          stroke="var(--accent-primary)"
                          style={{ fontSize: '12px' }}
                        />
                      )}
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--bg-elevated)",
                          border: "1px solid var(--border-strong)",
                          borderRadius: '16px',
                          padding: '12px'
                        }}
                        labelFormatter={(value) =>
                          format(new Date(Number(value)), "dd MMM yyyy, HH:mm", { locale: es })
                        }
                        formatter={(value: number, name: string) => getLineValueFormatter(value, name)}
                        labelStyle={{ color: "var(--text-body)", marginBottom: "4px" }}
                      />
                      <Legend formatter={(value) => <span style={{ color: "var(--text-body)" }}>{value}</span>} />
                      {irrigationSeries.waterFlow && (
                        <Line key="irrigation-line-water-flow" animationId={2101} yAxisId="flow" type="monotone" dataKey="waterFlow" name="Flujo agua (L/min)" stroke="var(--accent-gold)" strokeWidth={2.5} dot={false} />
                      )}
                      {irrigationSeries.eto && (
                        <Line key="irrigation-line-eto" animationId={2102} yAxisId="eto" type="monotone" dataKey="eto" name="E.T.O. (mm/día)" stroke="var(--accent-primary)" strokeWidth={2.2} dot={false} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          </div>
        ) : (
          selectedArea ? <EmptyState icon={ChartLine} title="No hay datos para el rango seleccionado" description="Prueba con otro rango o ciclo de cultivo." /> : null
        )}
      </BentoCard>

      {/* Data Table */}
      <BentoCard variant="light">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-lg text-[var(--text-title)]">
            Tabla de Datos{" "}
            <span className="text-sm text-[var(--text-subtle)] font-normal">
              {totalItems > 0 && `${totalItems} registros — pág. ${page} de ${totalPages}`}
            </span>
          </h2>
          <div role="group" aria-label="Descargar resultados" className="flex flex-wrap gap-2">
            <PillButton variant="secondary" className="text-sm flex items-center gap-2" disabled={exporting || !selectedArea} onClick={() => handleExport('csv')}>
              <Download className="w-4 h-4" /> CSV
            </PillButton>
            <PillButton variant="secondary" className="text-sm flex items-center gap-2" disabled={exporting || !selectedArea} onClick={() => handleExport('xlsx')}>
              <Download className="w-4 h-4" /> Excel
            </PillButton>
            <PillButton variant="secondary" className="text-sm flex items-center gap-2" disabled={exporting || !selectedArea} onClick={() => handleExport('pdf')}>
              <Download className="w-4 h-4" /> PDF
            </PillButton>
          </div>
        </div>

        {exporting && <p role="status" className="mb-2 text-sm text-[var(--text-muted)]">Descargando archivo…</p>}
        {exportError && <p role="alert" className="mb-2 text-sm text-[var(--status-danger-text)]">{exportError}</p>}
        {currentTable?.error && (
          <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-[var(--text-body)]">
            <span>{currentTable.error}</span>
            <PillButton variant="outline" aria-label="Reintentar histórico" onClick={() => setRetry((n) => n + 1)}>Reintentar</PillButton>
          </div>
        )}
        {loading && <p role="status" className="mb-2 text-sm text-[var(--text-muted)]">Cargando lecturas…</p>}
        <p className="mb-2 text-sm text-[var(--text-subtle)] md:hidden">Desliza hacia los lados para ver todas las columnas.</p>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <table className="w-full min-w-[1500px]">
            <caption className="sr-only">Lecturas del rango y ciclo seleccionados</caption>
            <thead>
              <tr className="border-b border-[var(--border-strong)]">
                <th scope="col" className="sticky left-0 z-10 bg-[var(--surface-panel)] text-left py-3 px-4 text-sm font-semibold text-[var(--text-subtle)]">Fecha/Hora (local)</th>
                {columns.map(({ label }) => <th key={label} scope="col" className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-subtle)]">{label}</th>)}
              </tr>
            </thead>
            <tbody className="relative">
              {selectedArea && !loading && !currentTable?.error && readings.length === 0 && (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-[var(--text-subtle)]">No hay registros.</td>
                </tr>
              )}
              {readings.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? "bg-[var(--surface-card-primary)]/60 hover:bg-[var(--hover-overlay)]" : "hover:bg-[var(--hover-overlay)] transition-colors"}>
                  <td className="sticky left-0 bg-[var(--surface-panel)] py-3 px-4 text-sm text-[var(--text-body)]">
                    {format(parseISO(normalizeTimestamp(r.timestamp)), "dd MMM yyyy, HH:mm", { locale: es })}
                  </td>
                  {columns.map(({ label, value }) => <td key={label} className="py-3 px-4 text-sm text-[var(--text-body)] font-mono-data font-medium">{displayValue(value(r))}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <nav aria-label="Paginación de la tabla" className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <PillButton variant="outline" disabled={page === 1} onClick={() => setPage(1)}>Inicio</PillButton>
            <PillButton variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</PillButton>
            <div className="px-4 text-sm font-medium text-[var(--text-subtle)]">
              Página {page} de {totalPages}
            </div>
            <PillButton variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</PillButton>
          </nav>
        )}
      </BentoCard>
    </div>
    </PageTransition>
  );
}
