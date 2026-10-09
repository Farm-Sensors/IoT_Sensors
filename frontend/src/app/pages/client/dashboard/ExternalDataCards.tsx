import axios from "axios";
import { useEffect, useState, type ReactNode } from "react";
import { BentoCard } from "../../../components/BentoCard";
import { usePageVisibility } from "../../../hooks/usePageVisibility";
import { api } from "../../../services/api";
import type { LatestNdvi, WeatherCurrent } from "../../../types/externalData";
import { parseBackendTimestamp } from "../../../utils/datetime";
import { DASHBOARD_REFRESH_MS } from "./helpers";

function ObservationTime({ value }: { value: string }) {
  const date = parseBackendTimestamp(value);
  return date ? <time dateTime={date.toISOString()}>{date.toLocaleString("es-MX")}</time> : <>Sin fecha</>;
}

function SourceCard<T>({ areaId, path, title, hideWhenUnavailable = false, emptyMessage, children }: {
  areaId: number;
  path: string;
  title: string;
  hideWhenUnavailable?: boolean;
  emptyMessage?: string;
  children: (data: T) => ReactNode;
}) {
  const visible = usePageVisibility();
  const [state, setState] = useState<{ data: T | null; error: boolean; unavailable: boolean; empty: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let inFlight = false;
    const fetchData = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await api.get<T | null>(path, { params: { irrigation_area_id: areaId } });
        if (!cancelled) setState({ data: response.data, error: false, unavailable: false, empty: false });
      } catch (error) {
        if (!cancelled) {
          const status = axios.isAxiosError(error) ? error.response?.status : undefined;
          if (status === 404 && emptyMessage) {
            setState({ data: null, error: false, unavailable: false, empty: true });
          } else {
            setState({ data: null, error: true, unavailable: status === 503, empty: false });
          }
        }
      } finally {
        inFlight = false;
      }
    };
    void fetchData();
    const timer = window.setInterval(() => void fetchData(), DASHBOARD_REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [areaId, path, visible, retry, emptyMessage]);

  // A service that is disabled on purpose (503) is not an error the client can act on.
  if (state?.unavailable && hideWhenUnavailable) {
    return null;
  }

  return (
    <BentoCard>
      <h3 className="mb-3 text-lg text-[var(--text-title)]">{title}</h3>
      {!state ? <p role="status">Cargando…</p> : state.empty ? (
        <p className="text-[var(--text-muted)]">{emptyMessage}</p>
      ) : state.error ? (
        <div role="alert" className="text-[var(--status-danger)]">
          <p>No se pudo cargar {title.toLowerCase()}.</p>
          <button type="button" className="mt-2 underline" onClick={() => setRetry((value) => value + 1)}>Reintentar</button>
        </div>
      ) : state.data === null ? <p>Sin datos disponibles.</p> : children(state.data)}
    </BentoCard>
  );
}

export function ExternalDataCards({ areaId }: { areaId: number }) {
  return (
    <section aria-label="Fuentes externas" className="mt-6">
      <h2 className="mb-4 text-xl text-[var(--text-title)]">Fuentes externas</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <SourceCard<WeatherCurrent> key={`weather-${areaId}`} areaId={areaId} path="/weather/current" title="Clima de referencia" hideWhenUnavailable>
          {(weather) => (
            <div className="space-y-2 text-[var(--text-body)]">
              <p>Fuente: {weather.provider} · {weather.cache_state === "fresh" ? "Datos actuales" : "Datos en caché sin actualizar"}</p>
              <p>Observado: <ObservationTime value={weather.current.observed_at} /></p>
              <dl className="grid grid-cols-2 gap-3">
                {([
                  ["Temperatura", "temperature_2m", weather.current.temperature_2m],
                  ["Humedad relativa", "relative_humidity_2m", weather.current.relative_humidity_2m],
                  ["Viento", "wind_speed_10m", weather.current.wind_speed_10m],
                  ["Radiación solar", "shortwave_radiation", weather.current.shortwave_radiation],
                  ["Precipitación del día", "precipitation_sum", weather.today.precipitation_sum],
                  ["ET₀ del día", "et0_fao_evapotranspiration", weather.today.et0_fao_evapotranspiration],
                ] as const).map(([label, key, value]) => (
                  <div key={key}><dt className="text-sm text-[var(--text-muted)]">{label}</dt><dd>{value ?? "Sin datos"} {weather.units[key]}</dd></div>
                ))}
              </dl>
              <p className="text-sm">Día de referencia: {weather.today.date}</p>
            </div>
          )}
        </SourceCard>
        <SourceCard<LatestNdvi> key={`ndvi-${areaId}`} areaId={areaId} path="/ndvi-snapshots/latest" title="NDVI puntual más reciente" emptyMessage="Sin NDVI todavía para esta área.">
          {(ndvi) => (
            <div className="space-y-2 text-[var(--text-body)]">
              <p className="text-3xl font-mono-data">{ndvi.ndvi}</p>
              <p>Fuente: {ndvi.provider}</p>
              <p>Sentinel-2 · {ndvi.collection} · Muestreo puntual</p>
              <p>Escena observada: <ObservationTime value={ndvi.scene_observed_at} /></p>
              <p>Nubosidad: {ndvi.cloud_cover_percent} %</p>
              <p className="break-all text-xs text-[var(--text-muted)]">Escena: {ndvi.scene_id}</p>
            </div>
          )}
        </SourceCard>
      </div>
    </section>
  );
}
