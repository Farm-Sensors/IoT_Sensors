import { differenceInCalendarDays, format } from "date-fns";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ErrorState } from "../../../components/ErrorState";
import { GatewayStatusBadge } from "../../../components/GatewayStatusBadge";
import { useModules } from "../../../hooks/useModules";
import { usePropertyGatewayStatus } from "../../../hooks/usePropertyGatewayStatus";
import { useSelection } from "../../../context/SelectionContext";
import { api } from "../../../services/api";
import { getGeoNodes, type GeoNode } from "../../../services/nodes";
import type { PaginatedResponse } from "../../../types/api";

interface Cycle { id: number; irrigation_area_id: number; start_date: string; end_date: string | null }

/** Un solo formato de fecha para el ciclo: dd/MM/aaaa. */
const day = (iso: string) => format(new Date(`${iso}T00:00:00`), "dd/MM/yyyy");
const isActive = (c: Cycle, today = format(new Date(), "yyyy-MM-dd")) => c.end_date === null || c.end_date >= today;

const REAL_PLACE = (text?: string | null) => (text && !/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(text.trim()) ? text : null);
/** 29.0892° N, 110.9588° O: coordenadas legibles en vez de 4 a 7 decimales sueltos. */
const coords = (lat: number, lon: number) => `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "O"}`;

const card = "h-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 md:p-5";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--border)] py-2.5">
      <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold">{children}</dd>
    </div>
  );
}

/** Área › Detalles: lo estático del área (cultivo, tamaño), su ciclo y su nodo. */
export function AreaDetails() {
  const { selectedArea, properties } = useSelection();
  const areaId = selectedArea?.id;
  const [state, setState] = useState<{ cycles: Cycle[]; node: GeoNode | null } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const gateway = usePropertyGatewayStatus(selectedArea?.property_id);
  const alertsEnabled = useModules().alerts;

  useEffect(() => {
    if (!areaId) return;
    const controller = new AbortController();
    setState(null);
    setError(false);
    (async () => {
      try {
        const params = new URLSearchParams({ irrigation_area_id: String(areaId), page: "1", per_page: "200" });
        const [cycles, geo] = await Promise.all([
          api.get<PaginatedResponse<Cycle>>(`/crop-cycles?${params}`, { signal: controller.signal }),
          getGeoNodes({ irrigation_area_id: areaId, include_without_coordinates: true, per_page: 1 }),
        ]);
        if (controller.signal.aborted) return;
        setState({ cycles: cycles.data.data.filter((c) => c.irrigation_area_id === areaId), node: geo.data[0] ?? null });
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    })();
    return () => controller.abort();
  }, [areaId, retry]);

  if (!selectedArea) return null;
  const property = properties.find((p) => p.id === selectedArea.property_id);
  if (error) return <ErrorState message="No se pudieron cargar los detalles del área." onRetry={() => setRetry((n) => n + 1)} />;
  if (!state) return <p role="status" className="text-sm text-[var(--text-muted)]">Cargando detalles…</p>;

  const active = state.cycles.filter((c) => isActive(c)).sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
  const past = state.cycles.filter((c) => c !== active).sort((a, b) => b.start_date.localeCompare(a.start_date));
  const node = state.node;
  const today = new Date();
  const elapsed = active ? Math.max(0, differenceInCalendarDays(today, new Date(`${active.start_date}T00:00:00`))) : 0;
  const total = active?.end_date ? Math.max(1, differenceInCalendarDays(new Date(`${active.end_date}T00:00:00`), new Date(`${active.start_date}T00:00:00`))) : null;
  const place = REAL_PLACE(property?.location);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section aria-labelledby="det-ciclo" className={`${card} focus-block self-start`}>
        <h2 id="det-ciclo" className="mb-3 text-base font-semibold">Ciclo de cultivo</h2>
        {active ? (
          <>
            <p className="text-2xl font-semibold leading-tight">
              {total ? <>Día <span className="font-mono-data">{Math.min(elapsed + 1, total)}</span> de <span className="font-mono-data">{total}</span></> : <>Desde hace <span className="font-mono-data">{elapsed}</span> {elapsed === 1 ? "día" : "días"}</>}
            </p>
            {total && (
              <div role="img" aria-label={`Avance del ciclo: ${Math.round((Math.min(elapsed, total) / total) * 100)} %`} className="mt-3 h-2 overflow-hidden rounded-[2px] bg-[var(--progress-track)]">
                <div className="h-full border-r-2 border-[var(--accent-primary)] bg-[var(--accent-soft)]" style={{ width: `${Math.max(2, Math.min(100, (elapsed / total) * 100))}%` }} />
              </div>
            )}
            <p className="mt-2 flex justify-between text-sm text-[var(--text-muted)]">
              <span className="font-mono-data">{day(active.start_date)}</span>
              <span className="font-mono-data">{active.end_date ? day(active.end_date) : "sin fecha de fin"}</span>
            </p>
          </>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Esta área no tiene un ciclo activo. El administrador lo define.</p>
        )}
        {past.length > 0 && (
          <div className="mt-5 border-t border-[var(--border)] pt-3">
            <h3 className="mb-1 text-sm font-semibold">Ciclos anteriores</h3>
            <ul className="divide-y divide-[var(--border)] text-sm">
              {past.slice(0, 5).map((c) => (
                <li key={c.id} className="py-1.5 font-mono-data">{day(c.start_date)} – {c.end_date ? day(c.end_date) : "sin fin"}</li>
              ))}
            </ul>
            {past.length > 5 && <p className="pt-1 text-xs text-[var(--text-muted)]">y {past.length - 5} más</p>}
          </div>
        )}
      </section>

      <section aria-labelledby="det-nodo" className={card}>
        <h2 id="det-nodo" className="mb-1 text-base font-semibold">Nodo</h2>
        {node ? (
          <dl>
            <Field label="Nombre">{node.name ?? "Sin nombre"}</Field>
            {node.serial_number && <Field label="Número de serie"><span className="font-mono-data">{node.serial_number}</span></Field>}
            {node.latitude !== null && node.longitude !== null && node.location_source === "property" ? (
              <>
                <Field label="GPS del nodo">Sin GPS</Field>
                <Field label="Ubicación en el mapa"><span className="font-mono-data">{coords(node.latitude, node.longitude)}</span> <span className="text-[var(--text-muted)]">(la del predio, aproximada)</span></Field>
              </>
            ) : (
              <Field label="GPS del nodo">
                {node.latitude !== null && node.longitude !== null ? <span className="font-mono-data">{coords(node.latitude, node.longitude)}</span> : "Sin GPS"}
              </Field>
            )}
            {place && <Field label="Ubicación del predio">{place}</Field>}
            {gateway && <Field label="Equipo del predio"><GatewayStatusBadge status={gateway.status} edgeStatus={gateway.edge_status} /></Field>}
          </dl>
        ) : (
          <p className="py-3 text-sm text-[var(--text-muted)]">Esta área no tiene nodo asignado. El administrador lo registra.</p>
        )}
        {node && node.latitude !== null && (
          <Link to={`/cliente/mapa?area=${selectedArea.id}`} className="mt-4 inline-flex min-h-[44px] items-center rounded-[var(--radius)] border border-[var(--border-strong)] px-4 text-sm font-semibold hover:bg-[var(--accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Abrir el mapa</Link>
        )}
      </section>

      {alertsEnabled && (
        <section aria-labelledby="det-reglas" className={`${card} md:col-span-2`}>
          <h2 id="det-reglas" className="mb-1 text-base font-semibold">Avisos de esta área</h2>
          <p className="text-sm text-[var(--text-muted)]">Define a partir de qué valores te avisamos de esta área.</p>
          <Link to={`/cliente/umbrales?area=${selectedArea.id}`} className="mt-3 inline-flex min-h-[44px] items-center rounded-[var(--radius)] border border-[var(--border-strong)] px-4 text-sm font-semibold hover:bg-[var(--accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Umbrales de esta área</Link>
        </section>
      )}
    </div>
  );
}
