import type { ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardCardKey } from "../../../services/dashboardPreferences";
import type { CurrentReadings, ChartReading } from "./readings";
import { getHumidityAxisDomain, type PriorityKey, type SemaphoreLevel } from "./helpers";
import { SemaphorePill } from "./SemaphorePill";

const panel = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]";

/** Un valor con su unidad; «Sin datos» (nunca un 0 inventado) cuando el nodo no lo envía. */
function Value({ value, unit, big = false }: { value: string | number; unit: string; big?: boolean }) {
  return (
    <p className={`font-mono-data font-medium ${big ? "text-[34px] leading-tight text-[var(--accent-green)]" : "text-xl"}`}>
      {value} <small className="font-sans text-sm text-[var(--text-muted)]">{unit}</small>
    </p>
  );
}

function Measure({ label, value, unit }: { label: string; value: string | number; unit: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] py-2 last:border-b-0">
      <dt className="text-sm text-[var(--text-muted)]">{label}</dt>
      <dd><Value value={value} unit={unit} /></dd>
    </div>
  );
}

/**
 * Área › Ahora: primero lo prioritario (humedad, flujo, E.T.O.), después la tendencia de 24 h y,
 * al final, las demás mediciones. Misma estructura en escritorio y móvil.
 */
export function AreaNowView({
  historicalData,
  currentReadings,
  prioritySemaphore,
  showSemaphore,
  visibleCards,
}: {
  historicalData: ChartReading[];
  currentReadings: CurrentReadings;
  prioritySemaphore: Record<PriorityKey, SemaphoreLevel>;
  /** Semáforo de umbrales; se oculta con el módulo de alertas apagado. */
  showSemaphore: boolean;
  visibleCards: Set<DashboardCardKey>;
}) {
  const priority: { key: DashboardCardKey; sem: PriorityKey; title: ReactNode; value: string | number; unit: string; extra?: ReactNode }[] = [
    { key: "priority.humidity", sem: "soil.humidity", title: "Humedad del Suelo", value: currentReadings.soilHumidity, unit: "%" },
    {
      key: "priority.flow", sem: "irrigation.flow_per_minute", title: "Flujo de Agua", value: currentReadings.waterFlow, unit: "L/min",
      extra: (
        <>
          <div className="-mx-1 mt-2 h-10" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData.slice(-24)}>
                <Area type="monotone" dataKey="waterFlow" stroke="var(--accent-primary)" fill="var(--accent-primary)" fillOpacity={0.12} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Acumulado: <span className="font-mono-data">{currentReadings.accumulatedWater}</span> L</p>
        </>
      ),
    },
    { key: "priority.eto", sem: "environmental.eto", title: <abbr title="Evapotranspiración" className="no-underline">E.T.O.</abbr>, value: currentReadings.eto, unit: "mm/día" },
  ];
  const shown = priority.filter((p) => visibleCards.has(p.key));

  return (
    <div className="space-y-6">
      {shown.length > 0 && (
        <section aria-label="Datos prioritarios" className={`${panel} border-t-[3px] border-t-[var(--brand-green)]`}>
          <div className={`grid divide-y divide-[var(--border)] md:divide-x md:divide-y-0 ${shown.length === 1 ? "md:grid-cols-1" : shown.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
            {shown.map((p) => (
              <div key={p.key} className="min-w-0 p-4 md:p-5">
                <h2 className="text-sm font-semibold text-[var(--text-muted)]">{p.title}</h2>
                <Value value={p.value} unit={p.unit} big />
                {showSemaphore && <div className="mt-1"><SemaphorePill level={prioritySemaphore[p.sem]} /></div>}
                {p.extra}
              </div>
            ))}
          </div>
        </section>
      )}

      {visibleCards.has("soil.chart") && (
        <section className={`${panel} p-4 md:p-5`}>
          <h2 className="mb-3 text-sm font-semibold">Humedad del suelo · últimas 24 h</h2>
          {historicalData.length === 0 && <p className="text-sm text-[var(--text-muted)]">Sin lecturas recientes para graficar.</p>}
          <div className="h-[220px] min-h-[220px] md:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="colorHumidity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" stroke="var(--text-muted)" style={{ fontSize: "12px" }} minTickGap={40} interval="preserveStartEnd" tick={{ fill: "var(--text-muted)" }} />
                <YAxis stroke="var(--text-muted)" style={{ fontSize: "12px" }} unit="%" domain={getHumidityAxisDomain(historicalData.map((point) => point.soilHumidity))} allowDecimals={false} tick={{ fill: "var(--text-muted)" }} />
                <Tooltip contentStyle={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", padding: "8px 12px", color: "var(--text-main)" }} />
                <Area type="monotone" dataKey="soilHumidity" stroke="var(--accent-primary)" strokeWidth={2} fill="url(#colorHumidity)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {(visibleCards.has("soil.details") || visibleCards.has("environmental.details")) && (
        <section className={`${panel} p-4 md:p-5`}>
          <h2 className="mb-1 text-sm font-semibold">Otras mediciones</h2>
          <div className="grid gap-x-10 md:grid-cols-2">
            {visibleCards.has("soil.details") && (
              <div>
                <h3 className="mt-3 text-xs font-semibold text-[var(--text-muted)]">Suelo</h3>
                <dl>
                  <Measure label="Conductividad" value={currentReadings.soilConductivity} unit="dS/m" />
                  <Measure label="Temperatura" value={currentReadings.soilTemp} unit="°C" />
                  <Measure label="Potencial hídrico" value={currentReadings.waterPotential} unit="MPa" />
                </dl>
              </div>
            )}
            {visibleCards.has("environmental.details") && (
              <div>
                <h3 className="mt-3 text-xs font-semibold text-[var(--text-muted)]">Ambiental</h3>
                <dl>
                  <Measure label="Temperatura del aire" value={currentReadings.airTemp} unit="°C" />
                  <Measure label="Humedad relativa" value={currentReadings.relativeHumidity} unit="%" />
                  <Measure label="Viento" value={currentReadings.windSpeed} unit="km/h" />
                  <Measure label="Radiación solar" value={currentReadings.solarRadiation} unit="W/m²" />
                </dl>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
