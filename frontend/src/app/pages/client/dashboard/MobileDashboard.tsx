import type { CurrentReadings, ChartReading } from "./readings";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { BentoCard } from "../../../components/BentoCard";
import { MetricCard } from "../../../components/MetricCard";
import {
  getIrrigationDisplayState,
  getIrrigationStatusClass,
  getIrrigationStatusLabel,
  type ConnectionState,
  type PriorityKey,
  type SemaphoreLevel,
} from "./helpers";
import type { DashboardCardKey } from "../../../services/dashboardPreferences";
import { SemaphorePill } from "./SemaphorePill";

export function MobileDashboard({
  historicalData,
  currentReadings,
  prioritySemaphore,
  connectionState,
  visibleCards,
}: {
  historicalData: ChartReading[];
  currentReadings: CurrentReadings;
  prioritySemaphore: Record<PriorityKey, SemaphoreLevel>;
  connectionState: ConnectionState;
  visibleCards: Set<DashboardCardKey>;
}) {
  const irrigationDisplayState = getIrrigationDisplayState(
    currentReadings.irrigationActive,
    connectionState,
  );
  const irrigationStatusLabel = getIrrigationStatusLabel(irrigationDisplayState);
  const irrigationStatusClass = getIrrigationStatusClass(irrigationDisplayState);
  const isIrrigationLiveActive = irrigationDisplayState === "active";

  return (
    <div className="space-y-4">
      {(visibleCards.has("priority.humidity") || visibleCards.has("priority.flow") || visibleCards.has("priority.eto")) && (
        <BentoCard variant="light">
          <h3 className="text-base text-[var(--text-main)] mb-3">Semáforos de Umbral</h3>
          <div className="grid grid-cols-1 gap-2">
            {visibleCards.has("priority.humidity") && (
              <div className="flex items-center justify-between rounded-[16px] bg-[var(--bg-elevated)] px-3 py-2">
                <span className="text-sm text-[var(--text-muted)]">Humedad suelo</span>
                <SemaphorePill level={prioritySemaphore["soil.humidity"]} />
              </div>
            )}
            {visibleCards.has("priority.flow") && (
              <div className="flex items-center justify-between rounded-[16px] bg-[var(--bg-elevated)] px-3 py-2">
                <span className="text-sm text-[var(--text-muted)]">Flujo agua</span>
                <SemaphorePill level={prioritySemaphore["irrigation.flow_per_minute"]} />
              </div>
            )}
            {visibleCards.has("priority.eto") && (
              <div className="flex items-center justify-between rounded-[16px] bg-[var(--bg-elevated)] px-3 py-2">
                <span className="text-sm text-[var(--text-muted)]">ETO</span>
                <SemaphorePill level={prioritySemaphore["environmental.eto"]} />
              </div>
            )}
          </div>
        </BentoCard>
      )}

      {/* Priority cards first */}
      {visibleCards.has("priority.humidity") && (
        <MetricCard
          title="Humedad del Suelo"
          value={currentReadings.soilHumidity}
          unit="%"
          variant="dark"
          subtitle="Dato prioritario"
          lastUpdate={currentReadings.lastUpdate}
          priority
        />
      )}

      {visibleCards.has("priority.flow") && (
        <MetricCard
          title="Flujo de Agua"
          value={currentReadings.waterFlow}
          unit="L/min"
          variant="dark"
          subtitle="Dato prioritario"
          lastUpdate={currentReadings.lastUpdate}
        >
          <div className="mb-2">
            <SemaphorePill level={prioritySemaphore["irrigation.flow_per_minute"]} />
          </div>
          <p className="text-sm text-[var(--text-on-dark)]/70 mt-2">
            Acumulado: {currentReadings.accumulatedWater} L
          </p>
        </MetricCard>
      )}

      {visibleCards.has("priority.eto") && (
        <MetricCard
          title="E.T.O."
          value={currentReadings.eto}
          unit="mm/día"
          variant="dark"
          subtitle="Evapotranspiración"
          lastUpdate={currentReadings.lastUpdate}
        >
          <div className="mb-2">
            <SemaphorePill level={prioritySemaphore["environmental.eto"]} />
          </div>
        </MetricCard>
      )}

      {/* Chart */}
      {visibleCards.has("soil.chart") && (
      <BentoCard variant="light">
        <h3 className="text-lg text-[var(--text-main)] mb-4">Últimas 12 lecturas</h3>
        {historicalData.length === 0 && <p className="text-[var(--text-muted)]">Sin lecturas recientes para graficar.</p>}
        <div className="h-[200px] min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historicalData}>
              <defs>
                <linearGradient id="colorHumidity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                stroke="var(--text-muted)"
                style={{ fontSize: "10px" }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="var(--text-muted)"
                style={{ fontSize: "10px" }}
                domain={[0, 100]}
              />
              <Area
                type="monotone"
                dataKey="soilHumidity"
                stroke="var(--accent-primary)"
                strokeWidth={2}
                fill="url(#colorHumidity)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </BentoCard>
      )}

      {/* Status */}
      {visibleCards.has("irrigation.status") && (
      <BentoCard variant="sand">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg text-[var(--text-main)]">Estado del Riego</h3>
          <div className={`w-3 h-3 rounded-full ${isIrrigationLiveActive ? 'bg-[var(--accent-primary)] animate-pulse' : 'bg-[var(--text-muted)]'}`} />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Estado</span>
            <span className={`font-bold ${irrigationStatusClass}`}>
              {irrigationStatusLabel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Antigüedad de la lectura</span>
            <span className="font-bold text-[var(--text-main)]">
              {currentReadings.irrigationElapsedTime}
            </span>
          </div>
        </div>
      </BentoCard>
      )}

      {/* Horizontal scroll cards for secondary metrics */}
      {visibleCards.has("soil.details") && (
      <div>
        <h3 className="text-lg text-[var(--text-main)] mb-3">Métricas de Suelo</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
          <BentoCard variant="sand" className="min-w-[200px]">
            <p className="text-sm text-[var(--text-muted)] mb-1">Conductividad</p>
            <p className="text-2xl font-bold font-mono-data text-[var(--text-main)]">
              {currentReadings.soilConductivity}{" "}
              <span className="text-base text-[var(--text-muted)] font-sans">dS/m</span>
            </p>
          </BentoCard>
          <BentoCard variant="sand" className="min-w-[200px]">
            <p className="text-sm text-[var(--text-muted)] mb-1">Temperatura</p>
            <p className="text-2xl font-bold font-mono-data text-[var(--text-main)]">
              {currentReadings.soilTemp}{" "}
              <span className="text-base text-[var(--text-muted)] font-sans">°C</span>
            </p>
          </BentoCard>
          <BentoCard variant="sand" className="min-w-[200px]">
            <p className="text-sm text-[var(--text-muted)] mb-1">Potencial hídrico</p>
            <p className="text-2xl font-bold font-mono-data text-[var(--text-main)]">
              {currentReadings.waterPotential}{" "}
              <span className="text-base text-[var(--text-muted)] font-sans">MPa</span>
            </p>
          </BentoCard>
        </div>
      </div>
      )}

      {/* Environmental */}
      {visibleCards.has("environmental.details") && (
      <BentoCard variant="light">
        <h3 className="text-lg text-[var(--text-main)] mb-4">Ambiental</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Temperatura aire</span>
            <span className="font-bold font-mono-data text-[var(--text-main)]">
              {currentReadings.airTemp} °C
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Humedad relativa</span>
            <span className="font-bold font-mono-data text-[var(--text-main)]">
              {currentReadings.relativeHumidity} %
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Viento</span>
            <span className="font-bold font-mono-data text-[var(--text-main)]">
              {currentReadings.windSpeed} km/h
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Radiación solar</span>
            <span className="font-bold font-mono-data text-[var(--text-main)]">
              {currentReadings.solarRadiation} W/m²
            </span>
          </div>
        </div>
      </BentoCard>
      )}
    </div>
  );
}
