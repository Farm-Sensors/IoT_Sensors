import { useCallback, useEffect, useRef, useState } from "react";
import type { IrrigationArea } from "../../../context/SelectionContext";
import { usePageVisibility } from "../../../hooks/usePageVisibility";
import { api } from "../../../services/api";
import { getGeoNodes } from "../../../services/nodes";
import type { PaginatedResponse, ReadingResponse } from "../../../types/api";
import { parseBackendTimestamp } from "../../../utils/datetime";
import { areaState, type AreaState, type SeriesPoint } from "./areaStatus";

export interface AreaOverviewRow {
  area: IrrigationArea;
  hasNode: boolean;
  lastUpdate: Date | null;
  latest: ReadingResponse | null;
  series: SeriesPoint[];
  state: AreaState;
  humidity: number | null;
  flow: number | null;
  eto: number | null;
  irrigating: boolean | null;
}

/** Mismo intervalo de sondeo que el dashboard (30 s). */
const POLL_MS = 30_000;

/**
 * Datos de la portada del productor con las llamadas que ya existen:
 * `/nodes/geo` (qué áreas tienen nodo), `/readings/latest` y `/readings` (24 h) por área.
 */
export function useAreaOverview(areas: IrrigationArea[]) {
  const [rows, setRows] = useState<AreaOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const visible = usePageVisibility();
  const inFlight = useRef(false);
  const key = areas.map((a) => a.id).join(",");

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const geo = await getGeoNodes({ per_page: 200, include_without_coordinates: true });
      const withNode = new Set(geo.data.map((n) => n.irrigation_area_id));
      const since = new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 10);
      const next = await Promise.all(areas.map(async (area): Promise<AreaOverviewRow> => {
        const hasNode = withNode.has(area.id);
        let latest: ReadingResponse | null = null;
        let series: SeriesPoint[] = [];
        if (hasNode) {
          const [l, s] = await Promise.allSettled([
            api.get<ReadingResponse | null>("/readings/latest", { params: { irrigation_area_id: area.id } }),
            api.get<PaginatedResponse<ReadingResponse>>("/readings", { params: { irrigation_area_id: area.id, start_date: since, page: 1, per_page: 200 } }),
          ]);
          latest = l.status === "fulfilled" ? l.value.data : null;
          if (s.status === "fulfilled") {
            const from = Date.now() - 24 * 3600_000;
            series = s.value.data.data.flatMap((r) => {
              const t = parseBackendTimestamp(r.timestamp);
              return t && t.getTime() >= from ? [{ t, humidity: r.soil?.humidity ?? null, flow: r.irrigation?.flow_per_minute ?? null }] : [];
            }).sort((a, b) => a.t.getTime() - b.t.getTime());
          }
        }
        const lastUpdate = parseBackendTimestamp(latest?.timestamp);
        return {
          area, hasNode, latest, series, lastUpdate,
          state: areaState(hasNode, lastUpdate),
          humidity: latest?.soil?.humidity ?? null,
          flow: latest?.irrigation?.flow_per_minute ?? null,
          eto: latest?.environmental?.eto ?? null,
          irrigating: latest?.irrigation?.active ?? null,
        };
      }));
      setRows(next);
      setError(null);
    } catch {
      setError("No se pudo cargar el resumen. Intenta de nuevo en unos segundos.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
    // `areas` entra por `key`: se recarga solo si cambia el conjunto de áreas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!areas.length) { setRows([]); setLoading(false); return; }
    void load();
    if (!visible) return;
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, visible, load]);

  return { rows, loading, error, reload: load };
}
