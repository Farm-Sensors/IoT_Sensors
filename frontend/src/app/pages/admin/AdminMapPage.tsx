import { ChevronLeft, ChevronRight, X } from "lucide-react";
import maplibregl, { type LngLatBoundsLike, Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ErrorState } from "../../components/ErrorState";
import { useGeoNodesData } from "../../components/maps/useGeoNodesData";
import { useTheme } from "../../context/ThemeContext";
import type { GeoNode } from "../../services/nodes";
import { AREA_STATE_LABEL, areaState, formatAgo, type AreaState } from "../client/overview/areaStatus";
import { StateBadge } from "../client/overview/OverviewCharts";

const LIGHT = "https://tiles.openfreemap.org/styles/liberty";
const DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

interface NodePin { node: GeoNode; state: AreaState }
interface PropertyPin { id: number; clientId: number; name: string; client: string; lat: number; lng: number; total: number; stale: number; state: AreaState }

const stateOf = (node: GeoNode): AreaState =>
  areaState(true, node.minutes_since_last_reading != null ? new Date(Date.now() - node.minutes_since_last_reading * 60_000) : null);

const chipCls = (on: boolean) =>
  `inline-flex min-h-[40px] items-center rounded-[var(--radius)] px-3 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${on ? "bg-[var(--accent-primary)] font-semibold text-[var(--text-inverted)]" : "font-medium text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--text-main)]"}`;

/**
 * Pin de predio o de área: nombre y una línea de estado. Se arma con textContent, nunca con HTML.
 * El nombre accesible empieza con el texto visible (WCAG 2.5.3, «label in name»; MapLibre pondría «Map marker»)
 * y le sigue `hint`, si lo hay.
 */
function buildPin(title: string, sub: string, state: AreaState, selected: boolean, hint: string | null, onClick: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "map-pin";
  el.dataset.state = state;
  el.classList.toggle("is-selected", selected);
  const name = document.createElement("span");
  name.textContent = title;
  const small = document.createElement("small");
  small.textContent = sub;
  el.append(name, " ", small);
  el.setAttribute("aria-label", `${title} ${sub}${hint ?? ""}`);
  el.addEventListener("click", (event) => { event.stopPropagation(); onClick(); });
  return el;
}

/**
 * Mapa de toda la red: primero un pin por predio (con su salud); al elegir un predio, un pin por área con su estado.
 * Desde cada área se entra a su ficha. Mismo vocabulario y mismo patrón que el mapa del productor.
 */
export function AdminMapPage() {
  const { theme } = useTheme();
  const [clientId, setClientId] = useState<number | null>(null);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [sized, setSized] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [, tick] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const fittedRef = useRef<string | null>(null);

  const styleUrl = theme === "dark" ? (import.meta.env.VITE_MAP_DARK_STYLE_URL || DARK) : (import.meta.env.VITE_MAP_STYLE_URL || LIGHT);
  const { nodes, loading, error, refresh } = useGeoNodesData({ errorMessage: "No se pudo cargar el mapa. Intenta nuevamente." });

  useEffect(() => { setUpdatedAt(Date.now()); }, [nodes]);
  useEffect(() => { const id = window.setInterval(() => tick((n) => n + 1), 30_000); return () => window.clearInterval(id); }, []);

  const clients = useMemo(() => Array.from(new Map(nodes.map((n) => [n.client_id, n.client_company_name])).entries()).map(([id, name]) => ({ id, name })), [nodes]);
  const inClient = useMemo(() => nodes.filter((n) => clientId === null || n.client_id === clientId), [nodes, clientId]);
  const located = (list: GeoNode[]) => list.filter((n) => n.latitude !== null && n.longitude !== null);

  const propertyPins = useMemo<PropertyPin[]>(() => {
    const groups = new Map<number, GeoNode[]>();
    inClient.forEach((n) => groups.set(n.property_id, [...(groups.get(n.property_id) ?? []), n]));
    return Array.from(groups.entries()).flatMap(([id, list]) => {
      const pts = located(list);
      if (pts.length === 0) return [];
      const stale = list.filter((n) => stateOf(n) === "sin_comunicacion").length;
      const noData = list.filter((n) => stateOf(n) === "sin_datos").length;
      return [{
        id, clientId: list[0].client_id, name: list[0].property_name, client: list[0].client_company_name, total: list.length, stale,
        lat: pts.reduce((sum, n) => sum + (n.latitude as number), 0) / pts.length,
        lng: pts.reduce((sum, n) => sum + (n.longitude as number), 0) / pts.length,
        state: (stale > 0 ? "sin_comunicacion" : noData > 0 ? "sin_datos" : "al_dia") as AreaState,
      }];
    });
  }, [inClient]);

  const areaPins = useMemo<NodePin[]>(() => propertyId === null ? [] : located(inClient.filter((n) => n.property_id === propertyId)).map((node) => ({ node, state: stateOf(node) })), [inClient, propertyId]);
  const scope = propertyId === null ? inClient : inClient.filter((n) => n.property_id === propertyId);
  const unplaced = scope.filter((n) => n.latitude === null || n.longitude === null);
  const counts = scope.reduce((acc, n) => { const s = stateOf(n); acc[s] = (acc[s] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const selected = areaPins.find((p) => p.node.irrigation_area_id === selectedAreaId) ?? null;
  const propertyName = propertyId !== null ? nodes.find((n) => n.property_id === propertyId)?.property_name : undefined;

  // Mapa: se crea una vez por estilo (claro u oscuro).
  useEffect(() => {
    if (!containerRef.current) return;
    const instance = new maplibregl.Map({ container: containerRef.current, style: styleUrl, center: [-106.0691, 28.632], zoom: 5, attributionControl: { compact: true } });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    setMap(instance);
    return () => { markersRef.current.forEach((m) => m.remove()); markersRef.current = []; fittedRef.current = null; instance.remove(); setMap(null); };
  }, [styleUrl]);

  // El contenedor toma su altura final después de crear el mapa.
  useEffect(() => {
    const el = containerRef.current;
    if (!map || !el) return;
    const observer = new ResizeObserver(() => { map.resize(); if (el.clientHeight > 0) setSized(true); });
    observer.observe(el);
    map.resize();
    return () => { observer.disconnect(); setSized(false); };
  }, [map]);

  // Pines: un predio por pin; con un predio elegido, un pin por área.
  useEffect(() => {
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    const make = (el: HTMLElement, lng: number, lat: number) => new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -4] }).setLngLat([lng, lat]).addTo(map);
    if (propertyId === null) {
      markersRef.current = propertyPins.map((pin) => {
        const sub = `${pin.total} ${pin.total === 1 ? "nodo" : "nodos"} · ${pin.stale > 0 ? `${pin.stale} sin comunicación` : pin.state === "sin_datos" ? "sin datos" : "al día"}`;
        return make(buildPin(pin.name, sub, pin.state, false, `. Cliente: ${pin.client}. Ver sus áreas`, () => { setSelectedAreaId(null); setPropertyId(pin.id); }), pin.lng, pin.lat);
      });
      return;
    }
    markersRef.current = areaPins.map(({ node, state }) => {
      const sub = state === "sin_comunicacion" && node.minutes_since_last_reading != null ? `sin comunicación · ${formatAgo(node.minutes_since_last_reading).replace("hace ", "")}` : AREA_STATE_LABEL[state];
      return make(buildPin(node.irrigation_area_name, sub, state, node.irrigation_area_id === selectedAreaId, null, () => setSelectedAreaId(node.irrigation_area_id)), node.longitude as number, node.latitude as number);
    });
  }, [map, propertyId, propertyPins, areaPins, selectedAreaId]);

  // Encuadre: al entrar y al cambiar de cliente o de predio.
  useEffect(() => {
    if (!map || !sized) return;
    const points: [number, number][] = propertyId === null ? propertyPins.map((p) => [p.lng, p.lat]) : areaPins.map((p) => [p.node.longitude as number, p.node.latitude as number]);
    if (points.length === 0) return;
    const key = `${clientId ?? "todos"}|${propertyId ?? "predios"}`;
    if (fittedRef.current === key) return;
    fittedRef.current = key;
    if (points.length === 1) { map.flyTo({ center: points[0], zoom: 13, essential: true }); return; }
    const bounds = new maplibregl.LngLatBounds();
    points.forEach((pt) => bounds.extend(pt));
    map.fitBounds(bounds as LngLatBoundsLike, { padding: { top: 100, bottom: 70, left: 130, right: 130 }, maxZoom: 13, duration: 600 });
  }, [map, sized, clientId, propertyId, propertyPins, areaPins]);

  const choose = (areaId: number) => {
    setSelectedAreaId(areaId);
    const pin = areaPins.find((p) => p.node.irrigation_area_id === areaId);
    if (map && pin) map.flyTo({ center: [pin.node.longitude as number, pin.node.latitude as number], zoom: Math.max(map.getZoom(), 13), essential: true });
  };

  const minutes = Math.floor((Date.now() - updatedAt) / 60_000);
  const statusLine = [`${counts.al_dia ?? 0} de ${scope.length} ${scope.length === 1 ? "nodo al día" : "nodos al día"}`, counts.sin_comunicacion ? `${counts.sin_comunicacion} sin comunicación` : null, counts.sin_datos ? `${counts.sin_datos} sin datos` : null].filter(Boolean).join(" · ");

  return (
    <div className="flex min-h-0 flex-col p-4 md:h-[calc(100dvh-57px)] md:p-6">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-[22px] font-semibold md:text-2xl">Mapa</h1>
          <p role="status" className="text-sm text-[var(--text-muted)]">
            {scope.length > 0 ? `${propertyId === null ? `${propertyPins.length} ${propertyPins.length === 1 ? "predio" : "predios"} · ` : `${propertyName} · `}${statusLine}` : loading ? "Cargando nodos…" : "Sin nodos registrados"} · Actualizado {minutes < 1 ? "hace un momento" : `hace ${formatAgo(minutes).replace("hace ", "")}`}
          </p>
        </div>
        {clients.length > 0 && (
          <div role="group" aria-label="Cliente" className="inline-flex max-w-full flex-wrap gap-0.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-1">
            <button type="button" aria-pressed={clientId === null} onClick={() => { setClientId(null); setPropertyId(null); setSelectedAreaId(null); }} className={chipCls(clientId === null)}>Todos los clientes</button>
            {clients.map((c) => <button key={c.id} type="button" aria-pressed={clientId === c.id} onClick={() => { setClientId(c.id); setPropertyId(null); setSelectedAreaId(null); }} className={chipCls(clientId === c.id)}>{c.name}</button>)}
          </div>
        )}
      </header>

      {propertyId !== null ? (
        <p className="mb-2 flex flex-wrap items-center gap-x-4 text-sm">
          <button type="button" onClick={() => { setSelectedAreaId(null); setPropertyId(null); }} className="inline-flex min-h-[40px] items-center gap-0.5 font-semibold text-[var(--accent-primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><ChevronLeft aria-hidden="true" className="h-4 w-4" />Todos los predios</button>
          <Link to={`/admin/predios/${propertyId}/areas`} className="inline-flex min-h-[40px] items-center gap-0.5 font-semibold text-[var(--accent-primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Abrir {propertyName} en Clientes<ChevronRight aria-hidden="true" className="h-4 w-4" /></Link>
        </p>
      ) : propertyPins.length > 0 && <p className="mb-2 text-sm text-[var(--text-muted)]">Toca un predio para ver sus áreas.</p>}
      {unplaced.length > 0 && propertyId !== null && (
        <p className="mb-2 text-sm text-[var(--text-muted)]">{unplaced.length === 1 ? "1 nodo no aparece" : `${unplaced.length} nodos no aparecen`} porque no tiene{unplaced.length === 1 ? "" : "n"} ubicación: {unplaced.map((n) => n.irrigation_area_name).join(", ")}.</p>
      )}
      {error && <ErrorState message={error} onRetry={refresh} />}

      <div role="region" aria-label="Mapa de la red" className="relative min-h-[60dvh] flex-1 overflow-hidden rounded-[var(--radius)] border border-[var(--border-strong)] md:min-h-[360px]">
        <div className="absolute inset-0" onClick={() => setSelectedAreaId(null)}><div ref={containerRef} className="h-full w-full bg-[var(--card)]" /></div>
        <ul aria-label="Leyenda" className="pointer-events-none absolute left-2 top-2 space-y-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-xs shadow-sm">
          {(["al_dia", "sin_comunicacion", "sin_datos"] as AreaState[]).map((s) => (
            <li key={s} className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-1 rounded-[1px]" style={{ background: s === "al_dia" ? "var(--status-success-solid)" : s === "sin_comunicacion" ? "var(--status-danger-text)" : "var(--text-muted)" }} />{AREA_STATE_LABEL[s]}</li>
          ))}
        </ul>
        {loading && nodes.length === 0 && <div role="status" className="absolute inset-0 flex items-center justify-center bg-[var(--card)]/70 text-sm">Cargando nodos…</div>}

        {selected && (
          <section aria-label={`Detalle de ${selected.node.irrigation_area_name}`} className="absolute inset-x-2 bottom-2 z-10 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--card)] p-4 shadow-lg md:inset-x-auto md:bottom-4 md:left-4 md:w-[340px]">
            <button type="button" aria-label="Cerrar" onClick={() => setSelectedAreaId(null)} className="absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:bg-[var(--accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><X aria-hidden="true" className="h-4 w-4" /></button>
            <h2 className="pr-10 text-base font-semibold">{selected.node.irrigation_area_name}</h2>
            <p className="text-sm text-[var(--text-muted)]">{[selected.node.client_company_name, selected.node.property_name, selected.node.crop_type_name].filter(Boolean).join(" · ")}</p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="text-sm text-[var(--text-muted)]">{selected.node.name || selected.node.serial_number || `Nodo #${selected.node.id}`}{!selected.node.is_active ? " · deshabilitado" : ""}</div>
              <div className="text-right">
                <StateBadge state={selected.state} />
                {selected.node.minutes_since_last_reading != null && <div className="text-xs text-[var(--text-muted)]">{formatAgo(selected.node.minutes_since_last_reading)}</div>}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Link to={`/admin/areas/${selected.node.irrigation_area_id}`} className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-[var(--radius)] bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--text-inverted)] hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2">Abrir área<ChevronRight aria-hidden="true" className="h-4 w-4" /></Link>
              <Link to={`/admin/nodos/${selected.node.id}`} className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius)] border border-[var(--border-strong)] px-4 text-sm font-semibold hover:bg-[var(--accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Ver nodo</Link>
            </div>
          </section>
        )}
      </div>

      {(propertyPins.length > 0) && (
        <details className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
          <summary className="flex min-h-[44px] cursor-pointer items-center px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Ver como lista ({propertyId === null ? propertyPins.length : areaPins.length})</summary>
          <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
            {propertyId === null ? propertyPins.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => { setSelectedAreaId(null); setPropertyId(p.id); }} className="flex min-h-[48px] w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-[var(--accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]">
                  <span className="min-w-0"><span className="block truncate font-medium">{p.name}</span><span className="block truncate text-xs text-[var(--text-muted)]">{p.client} · {p.total} {p.total === 1 ? "nodo" : "nodos"}</span></span>
                  <StateBadge state={p.state} />
                </button>
              </li>
            )) : areaPins.map((p) => (
              <li key={p.node.id}>
                <button type="button" aria-pressed={selectedAreaId === p.node.irrigation_area_id} onClick={() => choose(p.node.irrigation_area_id)} className="flex min-h-[48px] w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-[var(--accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] aria-pressed:bg-[var(--accent-soft)]">
                  <span className="min-w-0"><span className="block truncate font-medium">{p.node.irrigation_area_name}</span><span className="block truncate text-xs text-[var(--text-muted)]">{p.node.property_name}</span></span>
                  <StateBadge state={p.state} />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
