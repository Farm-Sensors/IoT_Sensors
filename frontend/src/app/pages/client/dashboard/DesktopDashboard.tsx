import type { CurrentReadings, ChartReading } from "./readings";
import { Droplets, Sun, Wind, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BentoCard } from "../../../components/BentoCard";
import { FreshnessIndicator } from "../../../components/FreshnessIndicator";
import { GatewayStatusBadge } from "../../../components/GatewayStatusBadge";
import { MetricCard } from "../../../components/MetricCard";
import {
  getIrrigationDisplayState,
  getIrrigationStatusClass,
  getIrrigationStatusLabel,
  type ConnectionState,
  type PriorityKey,
  type SemaphoreLevel,
} from "./helpers";
import { SemaphorePill } from "./SemaphorePill";

export function DesktopDashboard({
  historicalData,
  currentReadings,
  prioritySemaphore,
  connectionState,
}: {
  historicalData: ChartReading[];
  currentReadings: CurrentReadings;
  prioritySemaphore: Record<PriorityKey, SemaphoreLevel>;
  connectionState: ConnectionState;
}) {
  const irrigationDisplayState = getIrrigationDisplayState(
    currentReadings.irrigationActive,
    connectionState,
  );
  const irrigationStatusLabel = getIrrigationStatusLabel(irrigationDisplayState);
  const irrigationStatusClass = getIrrigationStatusClass(irrigationDisplayState);
  const isIrrigationLiveActive = irrigationDisplayState === "active";

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Priority Data - Dark Cards (Row 1) */}
      <div className="col-span-12 xl:col-span-4">
        <MetricCard
          title="Humedad del Suelo"
          value={currentReadings.soilHumidity}
          unit="%"
          variant="dark"
          subtitle="Dato prioritario"
          lastUpdate={currentReadings.lastUpdate}
          priority
        >
          <div className="mb-2">
            <SemaphorePill level={prioritySemaphore["soil.humidity"]} />
          </div>
          {/* Circular progress ring */}
          {typeof currentReadings.soilHumidity === "number" && <div className="relative w-32 h-32 mx-auto my-4">
            <svg className="transform -rotate-90 w-32 h-32">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="var(--border-strong)"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="var(--accent-gold)"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 56}`}
                strokeDashoffset={`${2 * Math.PI * 56 * (1 - currentReadings.soilHumidity / 100)}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.8s ease" }}
              />
            </svg>
          </div>}
        </MetricCard>
      </div>

      <div className="col-span-12 xl:col-span-4">
        <MetricCard
          title="Flujo de Agua"
          value={currentReadings.waterFlow}
          unit="L/min"
          variant="dark"
          subtitle="Dato prioritario"
          lastUpdate={currentReadings.lastUpdate}
          priority
        >
          <div className="mb-2">
            <SemaphorePill level={prioritySemaphore["irrigation.flow_per_minute"]} />
          </div>
          {/* Sparkline */}
          <div className="h-16 min-h-[64px] -mx-2 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData.slice(-12)}>
                <Area
                  type="monotone"
                  dataKey="waterFlow"
                  stroke="var(--accent-gold)"
                  fill="var(--accent-gold)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-[var(--text-on-dark)]/70 mt-2 font-mono-data">
            Acumulado: {currentReadings.accumulatedWater} L
          </p>
        </MetricCard>
      </div>

      <div className="col-span-12 xl:col-span-4">
        <MetricCard
          title="E.T.O."
          value={currentReadings.eto}
          unit="mm/día"
          variant="dark"
          subtitle="Evapotranspiración"
          lastUpdate={currentReadings.lastUpdate}
          priority
        >
          <div className="mb-2">
            <SemaphorePill level={prioritySemaphore["environmental.eto"]} />
          </div>
        </MetricCard>
      </div>

      {/* Irrigation Status (Row 2) */}
      <div className="col-span-12 xl:col-span-4 animate-stagger-1">
        <BentoCard variant="sand">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg text-[var(--text-main)]">Estado del Riego</h3>
            <div className="relative flex items-center justify-center w-4 h-4">
              {isIrrigationLiveActive && (
                <span
                  className="absolute inline-flex w-full h-full rounded-full bg-[var(--accent-primary)] opacity-50"
                  style={{ animation: "rippleExpand 2s ease-out infinite" }}
                />
              )}
              <span
                className={`relative block w-2.5 h-2.5 rounded-full transition-colors duration-500 ${
                  isIrrigationLiveActive ? 'bg-[var(--accent-primary)]' : 'bg-[var(--text-muted)]'
                }`}
              />
            </div>
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
      </div>

      {/* Soil Metrics (Row 2) */}
      <div className="col-span-12 xl:col-span-8">
        <BentoCard variant="light">
          <h3 className="text-lg text-[var(--text-main)] mb-4">Suelo</h3>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-[var(--text-muted)] mb-1">Conductividad</p>
              <p className="text-2xl font-bold font-mono-data text-[var(--text-main)]">
                {currentReadings.soilConductivity}{" "}
                <span className="text-base text-[var(--text-muted)] font-sans">dS/m</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)] mb-1">Temperatura</p>
              <p className="text-2xl font-bold font-mono-data text-[var(--text-main)]">
                {currentReadings.soilTemp}{" "}
                <span className="text-base text-[var(--text-muted)] font-sans">°C</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)] mb-1">Potencial hídrico</p>
              <p className="text-2xl font-bold font-mono-data text-[var(--text-main)]">
                {currentReadings.waterPotential}{" "}
                <span className="text-base text-[var(--text-muted)] font-sans">MPa</span>
              </p>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* Chart (Row 3) */}
      <div className="col-span-12 xl:col-span-8 row-span-2 animate-stagger-3">
        <BentoCard variant="light" className="h-full">
          <h3 className="text-lg text-[var(--text-main)] mb-6">
            Humedad del Suelo - Últimas 12 lecturas
          </h3>
          {historicalData.length === 0 && <p className="text-[var(--text-muted)]">Sin lecturas recientes para graficar.</p>}
          <div className="h-[300px] min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%" className="animate-chart-entrance">
              <AreaChart data={historicalData}>
                <defs>
                  <linearGradient
                    id="colorHumidity"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong)" />
                <XAxis
                  dataKey="time"
                  stroke="var(--text-muted)"
                  style={{ fontSize: "12px" }}
                  minTickGap={32}
                  interval="preserveStartEnd"
                  tick={{ fill: "var(--text-muted)" }}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  style={{ fontSize: "12px" }}
                  domain={["auto", "auto"]}
                  tick={{ fill: "var(--text-muted)" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-elevated)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: "16px",
                    padding: "12px",
                    color: "var(--text-main)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="soilHumidity"
                  stroke="var(--accent-primary)"
                  strokeWidth={3}
                  fill="url(#colorHumidity)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {currentReadings.lastUpdate && (
            <div className="flex flex-wrap items-center gap-3">
              <FreshnessIndicator lastUpdate={currentReadings.lastUpdate} />
              <GatewayStatusBadge />
            </div>
          )}
        </BentoCard>
      </div>

      {/* Environmental Metrics (Row 3-4) */}
      <div className="col-span-12 xl:col-span-4">
        <BentoCard variant="light" className="h-full">
          <h3 className="text-lg text-[var(--text-main)] mb-4">Ambiental</h3>
          <div className="divide-y divide-[var(--border-subtle)] rounded-[24px] overflow-hidden">
            <div className="flex items-center justify-between p-3 bg-[var(--bg-elevated)] transition-colors hover:bg-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[16px] bg-[var(--card-sand)]">
                  <Sun className="w-5 h-5 text-[var(--accent-primary)]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Temperatura aire</p>
                  <p className="font-bold font-mono-data text-[var(--text-main)]">
                    {currentReadings.airTemp} °C
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-[var(--bg-elevated)] transition-colors hover:bg-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[16px] bg-[var(--card-sand)]">
                  <Droplets className="w-5 h-5 text-[var(--accent-primary)]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Humedad relativa</p>
                  <p className="font-bold font-mono-data text-[var(--text-main)]">
                    {currentReadings.relativeHumidity} %
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-[var(--bg-elevated)] transition-colors hover:bg-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[16px] bg-[var(--card-sand)]">
                  <Wind className="w-5 h-5 text-[var(--accent-primary)]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Viento</p>
                  <p className="font-bold font-mono-data text-[var(--text-main)]">
                    {currentReadings.windSpeed} km/h
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-[var(--bg-elevated)] transition-colors hover:bg-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[16px] bg-[var(--card-sand)]">
                  <Zap className="w-5 h-5 text-[var(--accent-primary)]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Radiación solar</p>
                  <p className="font-bold font-mono-data text-[var(--text-main)]">
                    {currentReadings.solarRadiation} W/m²
                  </p>
                </div>
              </div>
            </div>
          </div>
        </BentoCard>
      </div>
    </div>
  );
}
