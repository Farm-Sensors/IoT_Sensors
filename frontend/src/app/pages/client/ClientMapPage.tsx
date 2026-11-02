import { ChevronRight, X } from "lucide-react";
import maplibregl, { type LngLatBoundsLike, Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ErrorState } from "../../components/ErrorState";
import { useGeoNodesData } from "../../components/maps/useGeoNodesData";
import { useSelection } from "../../context/SelectionContext";
import { useTheme } from "../../context/ThemeContext";
import type { GeoNode } from "../../services/nodes";
import { AREA_STATE_LABEL, formatAgo, minutesSince, type AreaState } from "./overview/areaStatus";
import { StateBadge } from "./overview/OverviewCharts";
import { useAreaOverview, type AreaOverviewRow } from "./overview/useAreaOverview";

const DEFAULT_LIGHT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const DEFAULT_DARK_STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

interface Pin { node: GeoNode; row: AreaOverviewRow | undefined; state: AreaState; humidity: number | null }

const chipCls = (on: boolean) =>
  `inline-flex min-h-[40px] items-center rounded-[var(--radius)] px-3 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${on ? "bg-[var(--accent-primary)] font-semibold text-[var(--text-inverted)]" : "font-medium text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--text-main)]"}`;

/** Elemento del pin: nombre del área y su humedad (o su estado). Se arma con textContent, nunca con HTML. */
function buildPinElement(pin: Pin, onClick: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "map-pin";
  el.dataset.state = pin.state;
  const name = document.createElement("span");
  name.textContent = pin.node.irrigation_area_name;
  const sub = document.createElement("small");
  sub.textContent = pin.state === "al_dia" && pin.humidity !== null ? `${pin.humidity.toFixed(0)} % humedad` : AREA_STATE_LABEL[pin.state];
  el.append(name, sub);
  el.setAttribute("aria-label", `${pin.node.irrigation_area_name}: ${sub.textContent}`);
  el.addEventListener("click", (event) => { event.stopPropagation(); onClick(); });
  return el;
}

interface PropertyPin { id: number; name: string; lat: number; lng: number; total: number; ok: number; state: AreaState }

/** Pin de predio: nombre y cuántas áreas están al día. Se arma con textContent. */
function buildPropertyPinElement(pin: PropertyPin, onClick: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "map-pin";
  el.dataset.state = pin.state;
  const name = document.createElement("span");
  name.textContent = pin.name;
  const sub = document.createElement("small");
  sub.textContent = `${pin.total} ${pin.total === 1 ? "área" : "áreas"} · ${pin.ok === pin.total ? "al día" : `${pin.ok} al día`}`;
  el.append(name, sub);
  el.setAttribute("aria-label", `${pin.name}: ${sub.textContent}. Ver sus áreas`);
  el.addEventListener("click", (event) => { event.stopPropagation(); onClick(); });
  return el;
}

/**
 * Mapa del productor: primero un pin por predio; al elegir un predio aparecen los pines de sus áreas
 * con su nombre y su humedad, y desde cada uno se entra al área.
 */
export function ClientMapPage() {
  const { theme } = useTheme();
  const { properties, areas } = useSelection();
  const [params] = useSearchParams();
  const requestedArea = Number(params.get("area")) || null;

  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(requestedArea);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [sized, setSized] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [, tick] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Map<number, { marker: Marker; el: HTMLButtonElement }>>(new Map());
  const fittedKeyRef = useRef<string | null>(null);

  const styleUrl = theme === "dark" ? (import.meta.env.VITE_MAP_DARK_STYLE_URL || DEFAULT_DARK_STYLE_URL) : (import.meta.env.VITE_MAP_STYLE_URL || DEFAULT_LIGHT_STYLE_URL);
  const { nodes, loading, error, refresh } = useGeoNodesData({ errorMessage: "No se pudo cargar el mapa. Intenta nuevamente." });
  const { rows } = useAreaOverview(areas);

  useEffect(() => { setUpdatedAt(Date.now()); }, [nodes, rows]);
  useEffect(() => { const id = window.setInterval(() => tick((n) => n + 1), 30_000); return () => window.clearInterval(id); }, []);

  const pins = useMemo<Pin[]>(() => nodes
    .filter((n) => n.latitude !== null && n.longitude !== null)
    .map((node) => {
      const row = rows.find((r) => r.area.id === node.irrigation_area_id);
      return { node, row, state: row?.state ?? (node.freshness_status === "fresh" ? "al_dia" : node.freshness_status === "stale" ? "sin_comunicacion" : "sin_datos") as AreaState, humidity: row?.humidity ?? null };
    }), [nodes, rows]);
  const visible = useMemo(() => (propertyId === null ? [] : pins.filter((p) => p.node.property_id === propertyId)), [pins, propertyId]);
  // Un pin por predio, en el centro de sus nodos.
  const propertyPins = useMemo<PropertyPin[]>(() => {
    const groups = new Map<number, Pin[]>();
    pins.forEach((p) => groups.set(p.node.property_id, [...(groups.get(p.node.property_id) ?? []), p]));
    return Array.from(groups.entries()).map(([id, list]) => {
      // El resumen cuenta todas las áreas del predio, aunque alguna no tenga ubicación y no lleve pin.
      const total = areas.filter((a) => a.property_id === id).length || list.length;
      const ok = rows.length ? rows.filter((r) => r.area.property_id === id && r.state === "al_dia").length : list.filter((p) => p.state === "al_dia").length;
      return {
        id, name: list[0].node.property_name, total, ok,
        lat: list.reduce((sum, p) => sum + (p.node.latitude as number), 0) / list.length,
        lng: list.reduce((sum, p) => sum + (p.node.longitude as number), 0) / list.length,
        state: (ok === total ? "al_dia" : "sin_comunicacion") as AreaState,
      };
    });
  }, [pins, areas, rows]);
  const scope = propertyId === null ? pins : visible;
  const selected = visible.find((p) => p.node.irrigation_area_id === selectedAreaId) ?? null;
  const pinned = new Set(pins.map((p) => p.node.irrigation_area_id));
  const unplaced = areas.filter((a) => !pinned.has(a.id) && (propertyId === null || a.property_id === propertyId));
  const counts = useMemo(() => scope.reduce((acc, p) => { acc[p.state] = (acc[p.state] ?? 0) + 1; return acc; }, {} as Record<string, number>), [scope]);

  // Mapa: se crea una vez por estilo (claro u oscuro).
  useEffect(() => {
    if (!containerRef.current) return;
    const instance = new maplibregl.Map({ container: containerRef.current, style: styleUrl, center: [-106.0691, 28.632], zoom: 6, attributionControl: { compact: true } });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    setMap(instance);
    const markers = markersRef.current;
    return () => { markers.forEach(({ marker }) => marker.remove()); markers.clear(); fittedKeyRef.current = null; instance.remove(); setMap(null); };
  }, [styleUrl]);

  // Pines: un predio por pin; con un predio elegido, un pin por área. Se rehacen cuando cambian los datos.
  useEffect(() => {
    if (!map) return;
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();
    if (propertyId === null) {
      propertyPins.forEach((pin) => {
        const el = buildPropertyPinElement(pin, () => { setSelectedAreaId(null); setPropertyId(pin.id); });
        const marker = new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -4] }).setLngLat([pin.lng, pin.lat]).addTo(map);
        markersRef.current.set(pin.id, { marker, el });
      });
      return;
    }
    visible.forEach((pin) => {
      const el = buildPinElement(pin, () => setSelectedAreaId(pin.node.irrigation_area_id));
      el.classList.toggle("is-selected", pin.node.irrigation_area_id === selectedAreaId);
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -4] }).setLngLat([pin.node.longitude as number, pin.node.latitude as number]).addTo(map);
      markersRef.current.set(pin.node.irrigation_area_id, { marker, el });
    });
  }, [map, propertyId, propertyPins, visible, selectedAreaId]);

  // Con `?area=` se abre directamente el predio de esa área y se centra en ella.
  const openedRequestedRef = useRef(false);
  useEffect(() => {
    if (!requestedArea || openedRequestedRef.current || pins.length === 0) return;
    const target = pins.find((p) => p.node.irrigation_area_id === requestedArea);
    openedRequestedRef.current = true;
    if (target) { setPropertyId(target.node.property_id); setSelectedAreaId(requestedArea); }
  }, [pins, requestedArea]);

  // Encuadre: al entrar y al cambiar de predio; con un área pedida o un solo punto, se acerca a él.
  useEffect(() => {
    if (!map || !sized) return;
    const points: [number, number][] = propertyId === null ? propertyPins.map((p) => [p.lng, p.lat]) : visible.map((p) => [p.node.longitude as number, p.node.latitude as number]);
    if (points.length === 0) return;
    const key = String(propertyId ?? "predios");
    if (fittedKeyRef.current === key) return;
    fittedKeyRef.current = key;
    const target = propertyId !== null && requestedArea ? visible.find((p) => p.node.irrigation_area_id === requestedArea) : undefined;
    if (target) { map.flyTo({ center: [target.node.longitude as number, target.node.latitude as number], zoom: 14, essential: true }); return; }
    if (points.length === 1) { map.flyTo({ center: points[0], zoom: 13, essential: true }); return; }
    const bounds = new maplibregl.LngLatBounds();
    points.forEach((pt) => bounds.extend(pt));
    map.fitBounds(bounds as LngLatBoundsLike, { padding: { top: 100, bottom: 70, left: 130, right: 130 }, maxZoom: 13, duration: 600 });
  }, [map, sized, propertyId, propertyPins, visible, requestedArea]);

  // El contenedor toma su altura final después de crear el mapa: se redimensiona cada vez que cambia de tamaño.
  useEffect(() => {
    const el = containerRef.current;
    if (!map || !el) return;
    const observer = new ResizeObserver(() => { map.resize(); if (el.clientHeight > 0) setSized(true); });
    observer.observe(el);
    map.resize();
    return () => { observer.disconnect(); setSized(false); };
  }, [map]);

  const choose = (areaId: number) => {
    setSelectedAreaId(areaId);
    const pin = pins.find((p) => p.node.irrigation_area_id === areaId);
    if (map && pin) map.flyTo({ center: [pin.node.longitude as number, pin.node.latitude as number], zoom: Math.max(map.getZoom(), 13), essential: true });
  };

  const minutes = Math.floor((Date.now() - updatedAt) / 60_000);
  const statusLine = [`${counts.al_dia ?? 0} de ${scope.length} ${scope.length === 1 ? "área al día" : "áreas al día"}`, counts.sin_comunicacion ? `${counts.sin_comunicacion} sin comunicación` : null, counts.sin_datos ? `${counts.sin_datos} sin datos` : null].filter(Boolean).join(" · ");

  return (
    <div className="flex h-full min-h-0 flex-col p-4 md:p-6">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-[22px] font-semibold md:text-2xl">Mapa</h1>
          <p role="status" className="text-sm text-[var(--text-muted)]">
            {pins.length > 0 ? (propertyId === null ? `${propertyPins.length} ${propertyPins.length === 1 ? "predio" : "predios"} · ${statusLine}` : statusLine) : loading ? "Cargando terrenos…" : "Sin terrenos con ubicación"} · Actualizado {minutes < 1 ? "hace un momento" : `hace ${formatAgo(minutes).replace("hace ", "")}`}
          </p>
        </div>
        <div role="group" aria-label="Predio" className="inline-flex max-w-full flex-wrap gap-0.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-1">
          <button type="button" aria-pressed={propertyId === null} onClick={() => { setSelectedAreaId(null); setPropertyId(null); }} className={chipCls(propertyId === null)}>Todos los predios</button>
          {properties.map((p) => (
            <button key={p.id} type="button" aria-pressed={propertyId === p.id} onClick={() => { setSelectedAreaId(null); setPropertyId(p.id); }} className={chipCls(propertyId === p.id)}>{p.name}</button>
          ))}
        </div>
      </header>

      {propertyId !== null ? (
        <p className="mb-2 text-sm">
          <Link to={`/cliente/predio/${propertyId}`} className="inline-flex min-h-[40px] items-center gap-0.5 font-semibold text-[var(--accent-primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Detalle de {properties.find((p) => p.id === propertyId)?.name ?? "este predio"}<ChevronRight aria-hidden="true" className="h-4 w-4" /></Link>
        </p>
      ) : pins.length > 0 && <p className="mb-2 text-sm text-[var(--text-muted)]">Toca un predio para ver sus áreas.</p>}
      {unplaced.length > 0 && propertyId !== null && (
        <p className="mb-2 text-sm text-[var(--text-muted)]">
          {unplaced.length === 1 ? "1 área no aparece" : `${unplaced.length} áreas no aparecen`} porque no tiene{unplaced.length === 1 ? "" : "n"} ubicación: {unplaced.map((a) => a.name).join(", ")}.
        </p>
      )}
      {error && <ErrorState message={error} onRetry={refresh} />}

      <div role="region" aria-label="Mapa de tus terrenos" className="relative min-h-[60dvh] flex-1 overflow-hidden md:min-h-[360px] rounded-[var(--radius)] border border-[var(--border-strong)]">
        <div className="absolute inset-0" onClick={() => setSelectedAreaId(null)}><div ref={containerRef} className="h-full w-full bg-[var(--card)]" /></div>
        <ul aria-label="Leyenda" className="pointer-events-none absolute left-2 top-2 space-y-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-xs shadow-sm">
          {(["al_dia", "sin_comunicacion", "sin_datos"] as AreaState[]).map((s) => (
            <li key={s} className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-1 rounded-[1px]" style={{ background: s === "al_dia" ? "var(--status-success-solid)" : s === "sin_comunicacion" ? "var(--status-danger-text)" : "var(--text-muted)" }} />{AREA_STATE_LABEL[s]}</li>
          ))}
        </ul>
        {loading && pins.length === 0 && <div role="status" className="absolute inset-0 flex items-center justify-center bg-[var(--card)]/70 text-sm">Cargando terrenos…</div>}

        {selected && (
          <section aria-label={`Detalle de ${selected.node.irrigation_area_name}`} className="absolute inset-x-2 bottom-2 z-10 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--card)] p-4 shadow-lg md:inset-x-auto md:bottom-4 md:left-4 md:w-[340px]">
            <button type="button" aria-label="Cerrar" onClick={() => setSelectedAreaId(null)} className="absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:bg-[var(--accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><X aria-hidden="true" className="h-4 w-4" /></button>
            <h2 className="pr-10 text-base font-semibold">{selected.node.irrigation_area_name}</h2>
            <p className="text-sm text-[var(--text-muted)]">{[selected.node.property_name, selected.node.crop_type_name].filter(Boolean).join(" · ")}</p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                {selected.state === "al_dia" && selected.humidity !== null
                  ? <span className="font-mono-data text-[28px] font-medium leading-none">{selected.humidity.toFixed(1)}<small className="ml-1 text-xs text-[var(--text-muted)]">% humedad</small></span>
                  : <span className="text-sm text-[var(--text-muted)]">Sin dato reciente</span>}
              </div>
              <div className="text-right">
                <StateBadge state={selected.state} />
                {selected.row?.lastUpdate && <div className="text-xs text-[var(--text-muted)]">{formatAgo(minutesSince(selected.row.lastUpdate))}</div>}
              </div>
            </div>
            <Link to={`/cliente/area/${selected.node.irrigation_area_id}`} className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-1 rounded-[var(--radius)] bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--text-inverted)] hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2">
              Abrir área<ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </section>
        )}
      </div>

      {pins.length > 0 && (
        <details className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
          <summary className="flex min-h-[44px] cursor-pointer items-center px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Ver como lista ({propertyId === null ? propertyPins.length : visible.length})</summary>
          <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
            {propertyId === null ? propertyPins.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => { setSelectedAreaId(null); setPropertyId(p.id); }} className="flex min-h-[48px] w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-[var(--accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]">
                  <span className="min-w-0"><span className="block truncate font-medium">{p.name}</span><span className="block truncate text-xs text-[var(--text-muted)]">{p.total} {p.total === 1 ? "área" : "áreas"} · {p.ok} al día</span></span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />
                </button>
              </li>
            )) : visible.map((p) => (
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
