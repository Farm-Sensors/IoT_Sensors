import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronRight, GripVertical, Pencil, RotateCcw, Warehouse } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { SkeletonCard } from "../../components/SkeletonCard";
import { useAuth } from "../../context/AuthContext";
import { useSelection } from "../../context/SelectionContext";
import { AREA_STATE_LABEL, AREA_STATE_ORDER, formatAgo, hourlyHumidity, hourlyLiters, minutesSince, summarize } from "./overview/areaStatus";
import { HumidityChart, LitersChart, StateBadge } from "./overview/OverviewCharts";
import { applyOrder, moveBy, moveTo, useSavedOrder } from "./overview/order";
import { useAreaOverview, type AreaOverviewRow } from "./overview/useAreaOverview";

const HATCH = "repeating-linear-gradient(135deg, transparent 0 7px, color-mix(in srgb, var(--text-muted) 22%, transparent) 7px 8px)";

/**
 * Un área del predio dibujada como parcela: su ancho es proporcional a las hectáreas y la humedad
 * es el nivel de agua que sube desde abajo (0–100 %). El nivel no juzga si es poco o mucho (no hay
 * umbrales); un área sin datos recientes no dibuja nivel ni cifra, solo trama y su estado.
 */
interface TileEdit {
  canBack: boolean;
  canForward: boolean;
  dragging: boolean;
  onBack: () => void;
  onForward: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropHere: () => void;
}

function AreaTile({ row, weight, now, edit }: { row: AreaOverviewRow; weight: number; now: number; edit?: TileEdit }) {
  const ok = row.state === "al_dia" && row.humidity !== null;
  const minutes = row.lastUpdate ? minutesSince(row.lastUpdate, now) : null;
  const level = ok ? Math.min(100, Math.max(0, row.humidity!)) : 0;
  // El agua sube desde 0 hasta su nivel al cargar: así se entiende que es un medidor y no una barra rota.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(level));
    return () => cancelAnimationFrame(frame);
  }, [level]);
  const detail = [row.area.crop_type?.name, row.area.area_size ? `${row.area.area_size} ha` : null].filter(Boolean).join(" · ");
  const rootClass = "group relative flex min-w-[158px] flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--card)]";
  const rootStyle = { flex: `${weight} 1 0`, backgroundImage: ok ? undefined : HATCH };
  const content = (
    <>
      <div className="min-h-[60px] min-w-0 flex-1 p-3 pr-14">
        <div className="line-clamp-2 text-sm font-semibold leading-snug">{row.area.name}</div>
        <div className="truncate text-xs text-[var(--text-muted)]">{detail}</div>
      </div>
      {/* Cuerpo de la parcela: el nivel de agua sube dentro de esta zona, nunca bajo el nombre. */}
      <div className="relative flex h-[104px] flex-none items-end p-3">
        {ok && (
          <>
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 bg-[var(--accent-soft)] transition-[height] duration-[1100ms] ease-out" style={{ height: `${Math.max(shown, 4)}%` }}>
              {/* Superficie del agua: una onda lenta que da vida al nivel sin cambiar su valor. */}
              <span className="absolute inset-x-0 -top-[5px] h-[10px] overflow-hidden">
                <svg viewBox="0 0 200 10" preserveAspectRatio="none" className="tile-wave h-full w-[200%] text-[var(--accent-soft)]">
                  <path d="M0 5Q12.5 0 25 5T50 5T75 5T100 5T125 5T150 5T175 5T200 5V10H0Z" fill="currentColor" />
                  <path d="M0 5Q12.5 0 25 5T50 5T75 5T100 5T125 5T150 5T175 5T200 5" fill="none" stroke="var(--accent-primary)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
                </svg>
              </span>
            </span>
            {/* Escala: marcas al 25, 50 y 75 % para que se lea como medidor. */}
            {[25, 50, 75].map((mark) => (
              <span key={mark} aria-hidden="true" className="absolute right-0 h-px w-2 bg-[var(--text-muted)] opacity-50" style={{ bottom: `${mark}%` }} />
            ))}
          </>
        )}
        {ok ? (
          <div className="relative z-10 font-mono-data text-[28px] font-medium leading-none">{row.humidity!.toFixed(1)}<small className="ml-1 text-xs text-[var(--text-muted)]">% humedad</small></div>
        ) : (
          <div className="relative space-y-0.5">
            <StateBadge state={row.state} />
            <div className="text-xs text-[var(--text-muted)]">{minutes === null ? "Sin lecturas" : `Último dato ${formatAgo(minutes)}`}</div>
          </div>
        )}
      </div>
    </>
  );

  if (edit) {
    return (
      <div
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", String(row.area.id));
          edit.onDragStart();
        }}
        onDragEnd={edit.onDragEnd}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          edit.onDropHere();
        }}
        style={rootStyle}
        className={`${rootClass} cursor-grab border-dashed active:cursor-grabbing ${edit.dragging ? "opacity-40" : ""}`}
      >
        <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5">
          <button type="button" onClick={edit.onBack} disabled={!edit.canBack} aria-label={`Mover ${row.area.name} antes`} title="Mover antes" className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><ArrowLeft aria-hidden="true" className="h-4 w-4" /></button>
          <button type="button" onClick={edit.onForward} disabled={!edit.canForward} aria-label={`Mover ${row.area.name} después`} title="Mover después" className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><ArrowRight aria-hidden="true" className="h-4 w-4" /></button>
          <GripVertical aria-hidden="true" className="h-4 w-4 text-[var(--text-muted)]" />
        </div>
        {content}
      </div>
    );
  }

  return (
    <Link
      to={`/cliente/area/${row.area.id}`}
      aria-label={`Abrir ${row.area.name}: ${ok ? `${row.humidity!.toFixed(1)} % de humedad` : "sin datos recientes"}, ${AREA_STATE_LABEL[row.state].toLowerCase()}`}
      style={rootStyle}
      className={`${rootClass} transition-colors hover:border-[var(--accent-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]`}
    >
      <span aria-hidden="true" className="absolute right-2 top-2 z-10 inline-flex items-center text-xs font-semibold text-[var(--accent-primary)] opacity-80 group-hover:opacity-100">Abrir<ChevronRight className="h-3.5 w-3.5" /></span>
      {content}
    </Link>
  );
}

const TILE_MIN = 158;
const TILE_GAP = 8;

/**
 * Las parcelas de un predio. Si caben todas en una fila, su ancho es proporcional a las hectáreas (el plano);
 * si no caben (muchas áreas o poco espacio), pasan a una cuadrícula de parcelas iguales en vez de partirse en
 * filas con anchos engañosos. Sin hectáreas registradas, la parcela pesa lo mismo que las demás.
 */
interface RowEdit {
  draggingId: number | null;
  onMove: (areaId: number, delta: -1 | 1) => void;
  onDragStart: (areaId: number) => void;
  onDragEnd: () => void;
  onDrop: (targetId: number) => void;
}

function PlotRow({ list, share, now, edit }: { list: AreaOverviewRow[]; share: number; now: number; edit?: RowEdit }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () => setAvailable(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const needed = list.length * TILE_MIN + (list.length - 1) * TILE_GAP;
  const fits = available === 0 || needed <= available;
  const known = list.filter((r) => r.area.area_size).map((r) => r.area.area_size as number);
  const fallbackWeight = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 1;
  // Ancho del plano: proporcional a las hectáreas del predio, nunca menor que lo que necesitan sus parcelas.
  const planWidth = available ? Math.min(available, Math.max(Math.round((available * share) / 100), 340, needed)) : undefined;

  return (
    <div ref={wrapperRef} className="w-full">
      <div
        className={fits ? "flex gap-2" : "grid gap-2"}
        style={fits ? { width: planWidth ?? "100%" } : { gridTemplateColumns: `repeat(auto-fill, minmax(${TILE_MIN}px, 1fr))` }}
      >
        {list.map((r, index) => (
          <AreaTile
            key={r.area.id}
            row={r}
            weight={fits ? r.area.area_size ?? fallbackWeight : 1}
            now={now}
            edit={
              edit
                ? {
                    canBack: index > 0,
                    canForward: index < list.length - 1,
                    dragging: edit.draggingId === r.area.id,
                    onBack: () => edit.onMove(r.area.id, -1),
                    onForward: () => edit.onMove(r.area.id, 1),
                    onDragStart: () => edit.onDragStart(r.area.id),
                    onDragEnd: edit.onDragEnd,
                    onDropHere: () => edit.onDrop(r.area.id),
                  }
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

/** Portada del productor: primero sus predios y áreas; el resumen de 24 h queda plegado al final. El mapa vive en `/cliente/mapa`. */
export function PropertiesOverview() {
  const { properties, areas, loading: selectionLoading, error: selectionError } = useSelection();
  const { rows, loading, error } = useAreaOverview(areas);
  const { user } = useAuth();
  const { order, save, reset, hasCustomOrder } = useSavedOrder(String(user?.sub ?? "anon"));
  const [editing, setEditing] = useState(false);
  const [drag, setDrag] = useState<{ kind: "predio"; id: number } | { kind: "area"; propertyId: number; id: number } | null>(null);
  const now = Date.now();

  if (selectionLoading || loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="mb-6 h-8 w-56 animate-shimmer rounded" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{[1, 2].map((i) => <SkeletonCard key={i} lines={3} />)}</div>
      </div>
    );
  }
  if (selectionError || error) return <div className="p-4 md:p-8"><h1 className="mb-4">Mis predios</h1><ErrorState message={selectionError ?? error ?? ""} /></div>;
  if (!areas.length) {
    return (
      <div className="p-4 md:p-8">
        <h1 className="mb-4">Mis predios</h1>
        <EmptyState icon={Warehouse} title="Sin áreas de riego" description="Todavía no hay áreas asignadas a tu cuenta. Contacta al administrador." />
      </div>
    );
  }

  const summary = summarize(rows);
  const baseGroups = properties.map((p) => ({ property: p, rows: rows.filter((r) => r.area.property_id === p.id) })).filter((g) => g.rows.length);
  // Orden elegido por la persona (guardado en este navegador); lo nuevo va al final.
  const withRows = applyOrder(baseGroups, order.properties, (g) => g.property.id).map((g) => ({
    ...g,
    rows: applyOrder(g.rows, order.areas[String(g.property.id)], (r) => r.area.id),
  }));
  const propertyIds = withRows.map((g) => g.property.id);
  const movePropertyBy = (id: number, delta: -1 | 1) => save({ ...order, properties: moveBy(propertyIds, id, delta) });
  const dropProperty = (targetId: number) => {
    if (drag?.kind === "predio") save({ ...order, properties: moveTo(propertyIds, drag.id, targetId) });
    setDrag(null);
  };
  const moveAreaBy = (propertyId: number, areaId: number, delta: -1 | 1) => {
    const current = (withRows.find((g) => g.property.id === propertyId)?.rows ?? []).map((r) => r.area.id);
    save({ ...order, properties: propertyIds, areas: { ...order.areas, [String(propertyId)]: moveBy(current, areaId, delta) } });
  };
  const dropArea = (propertyId: number, targetId: number) => {
    if (drag?.kind === "area" && drag.propertyId === propertyId) {
      const current = (withRows.find((g) => g.property.id === propertyId)?.rows ?? []).map((r) => r.area.id);
      save({ ...order, properties: propertyIds, areas: { ...order.areas, [String(propertyId)]: moveTo(current, drag.id, targetId) } });
    }
    setDrag(null);
  };
  const maxHectares = Math.max(1, ...withRows.map(({ rows: l }) => l.reduce((sum, r) => sum + (r.area.area_size ?? 0), 0)));
  const okRows = rows.filter((r) => r.state === "al_dia");
  const liters = hourlyLiters(okRows.map((r) => r.series), now);
  const problems = AREA_STATE_ORDER.filter((k) => k !== "al_dia" && summary.counts[k] > 0).map((k) => `${summary.counts[k]} ${AREA_STATE_LABEL[k].toLowerCase()}`);

  return (
    <div className="mx-auto max-w-[1100px] space-y-9 p-4 md:p-8">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold md:text-2xl">Mis predios</h1>
            <p role="status" className="mt-1 text-base">
              <b className="font-semibold">{summary.reporting} de {summary.total} áreas al día</b>
              {problems.length > 0 && <span className="text-[var(--status-danger-text)]"> · {problems.join(" · ")}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {editing && hasCustomOrder && (
              <button type="button" onClick={reset} className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius)] border border-[var(--border-strong)] px-3 text-sm font-semibold hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                <RotateCcw aria-hidden="true" className="h-4 w-4" />Restablecer orden
              </button>
            )}
            <button
              type="button"
              aria-pressed={editing}
              onClick={() => { setEditing((value) => !value); setDrag(null); }}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius)] border px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${editing ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--text-inverted)]" : "border-[var(--border-strong)] hover:bg-[var(--hover-overlay)]"}`}
            >
              {!editing && <Pencil aria-hidden="true" className="h-4 w-4" />}
              {editing ? "Listo" : "Ordenar"}
            </button>
          </div>
        </div>
        {editing && (
          <p role="status" className="mt-3 rounded-[var(--radius)] bg-[var(--accent-soft)] px-3 py-2 text-sm">
            Arrastra los predios y las áreas, o usa las flechas, para cambiar su orden. Se guarda en este navegador y solo lo ves tú.
          </p>
        )}
      </header>

      {withRows.map(({ property: p, rows: list }) => {
        const ok = list.filter((r) => r.state === "al_dia").length;
        const bad = list.length - ok;
        const hectares = list.reduce((sum, r) => sum + (r.area.area_size ?? 0), 0);
        // El ancho del plano de cada predio es proporcional a sus hectáreas respecto del mayor.
        const width = Math.max(26, Math.round((hectares / maxHectares) * 100));
        return (
          <section
            key={p.id}
            aria-labelledby={`predio-${p.id}`}
            className={`min-w-0 ${editing && drag?.kind === "predio" && drag.id === p.id ? "opacity-40" : ""}`}
            onDragOver={editing && drag?.kind === "predio" ? (event) => event.preventDefault() : undefined}
            onDrop={editing && drag?.kind === "predio" ? (event) => { event.preventDefault(); dropProperty(p.id); } : undefined}
          >
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
                {editing && (
                  <span className="flex items-center gap-0.5 self-center">
                    <span
                      draggable
                      onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(p.id)); setDrag({ kind: "predio", id: p.id }); }}
                      onDragEnd={() => setDrag(null)}
                      title="Arrastra para mover el predio"
                      className="inline-flex h-9 w-9 cursor-grab items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] active:cursor-grabbing"
                    >
                      <GripVertical aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <button type="button" onClick={() => movePropertyBy(p.id, -1)} disabled={propertyIds.indexOf(p.id) === 0} aria-label={`Subir ${p.name}`} title="Subir" className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><ArrowUp aria-hidden="true" className="h-4 w-4" /></button>
                    <button type="button" onClick={() => movePropertyBy(p.id, 1)} disabled={propertyIds.indexOf(p.id) === propertyIds.length - 1} aria-label={`Bajar ${p.name}`} title="Bajar" className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><ArrowDown aria-hidden="true" className="h-4 w-4" /></button>
                  </span>
                )}
                <h2 id={`predio-${p.id}`} className="text-lg font-semibold">{p.name}</h2>
                <p className={`text-sm ${bad ? "font-medium text-[var(--status-danger-text)]" : "text-[var(--text-muted)]"}`}>
                  {hectares > 0 ? `${hectares} ha · ` : ""}{list.length} {list.length === 1 ? "área" : "áreas"}{bad ? ` · ${ok} al día` : ""}
                </p>
              </div>
              <Link to={`/cliente/predio/${p.id}`} aria-label={`Ver el detalle del predio ${p.name}`} className="inline-flex min-h-[44px] items-center gap-0.5 text-sm font-semibold text-[var(--accent-primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                Detalle del predio<ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
            <PlotRow
              list={list}
              share={width}
              now={now}
              edit={editing ? {
                draggingId: drag?.kind === "area" && drag.propertyId === p.id ? drag.id : null,
                onMove: (areaId, delta) => moveAreaBy(p.id, areaId, delta),
                onDragStart: (areaId) => setDrag({ kind: "area", propertyId: p.id, id: areaId }),
                onDragEnd: () => setDrag(null),
                onDrop: (targetId) => dropArea(p.id, targetId),
              } : undefined}
            />
          </section>
        );
      })}

      <details className="group rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        <summary className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
          <span>Resumen de las últimas 24 h <span className="font-normal text-[var(--text-muted)]">· humedad y flujo de agua</span></span>
          <ChevronRight aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-90" />
        </summary>
        <div className="space-y-6 border-t border-[var(--border)] p-4">
          <p className="text-sm text-[var(--text-muted)]">
            {summary.flowNow === null ? "Flujo ahora: —" : `Flujo ahora: ${summary.flowNow.toFixed(1)} L/min`} · {summary.irrigating} {summary.irrigating === 1 ? "área con riego encendido" : "áreas con riego encendido"}
          </p>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <h2 className="mb-2 text-sm font-semibold">Humedad del suelo por predio <span className="text-xs font-normal text-[var(--text-muted)]">promedio de sus áreas al día</span></h2>
              <HumidityChart now={now} series={withRows.map(({ property: p, rows: list }) => ({ name: p.name, points: hourlyHumidity(list.filter((r) => r.state === "al_dia").map((r) => r.series), now) })).filter((s) => s.points.length)} />
            </div>
            <div className="min-w-0">
              <h2 className="mb-2 text-sm font-semibold">Flujo de agua total <span className="text-xs font-normal text-[var(--text-muted)]">litros por hora</span></h2>
              <LitersChart buckets={liters} />
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
