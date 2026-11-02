import { ChevronRight, Warehouse } from "lucide-react";
import { Link } from "react-router";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { SkeletonCard } from "../../components/SkeletonCard";
import { useSelection } from "../../context/SelectionContext";
import { AREA_STATE_LABEL, AREA_STATE_ORDER, formatAgo, hourlyHumidity, hourlyLiters, minutesSince, summarize } from "./overview/areaStatus";
import { HumidityChart, LitersChart, StateBadge } from "./overview/OverviewCharts";
import { useAreaOverview, type AreaOverviewRow } from "./overview/useAreaOverview";

const HATCH = "repeating-linear-gradient(135deg, transparent 0 7px, color-mix(in srgb, var(--text-muted) 22%, transparent) 7px 8px)";

/**
 * Un área del predio dibujada como parcela: su ancho es proporcional a las hectáreas y la humedad
 * es el nivel de agua que sube desde abajo (0–100 %). El nivel no juzga si es poco o mucho (no hay
 * umbrales); un área sin datos recientes no dibuja nivel ni cifra, solo trama y su estado.
 */
function AreaTile({ row, weight, now }: { row: AreaOverviewRow; weight: number; now: number }) {
  const ok = row.state === "al_dia" && row.humidity !== null;
  const minutes = row.lastUpdate ? minutesSince(row.lastUpdate, now) : null;
  const level = ok ? Math.min(100, Math.max(0, row.humidity!)) : 0;
  const detail = [row.area.crop_type?.name, row.area.area_size ? `${row.area.area_size} ha` : null].filter(Boolean).join(" · ");
  return (
    <Link
      to={`/cliente/area/${row.area.id}`}
      aria-label={`Abrir ${row.area.name}: ${ok ? `${row.humidity!.toFixed(1)} % de humedad` : "sin datos recientes"}, ${AREA_STATE_LABEL[row.state].toLowerCase()}`}
      style={{ flex: `${weight} 1 0`, backgroundImage: ok ? undefined : HATCH }}
      className="group relative flex min-w-[158px] flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--card)] transition-colors hover:border-[var(--accent-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      <span aria-hidden="true" className="absolute right-2 top-2 z-10 inline-flex items-center text-xs font-semibold text-[var(--accent-primary)] opacity-80 group-hover:opacity-100">Abrir<ChevronRight className="h-3.5 w-3.5" /></span>
      <div className="min-h-[60px] min-w-0 flex-1 p-3 pr-14">
        <div className="line-clamp-2 text-sm font-semibold leading-snug">{row.area.name}</div>
        <div className="truncate text-xs text-[var(--text-muted)]">{detail}</div>
      </div>
      {/* Cuerpo de la parcela: el nivel de agua sube dentro de esta zona, nunca bajo el nombre. */}
      <div className="relative flex h-[104px] flex-none items-end p-3">
        {ok && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 border-t-2 border-[var(--accent-primary)] bg-[var(--accent-soft)] transition-[height] duration-700" style={{ height: `${Math.max(level, 4)}%` }} />}
        {ok ? (
          <div className="relative font-mono-data text-[28px] font-medium leading-none">{row.humidity!.toFixed(1)}<small className="ml-1 text-xs text-[var(--text-muted)]">% humedad</small></div>
        ) : (
          <div className="relative space-y-0.5">
            <StateBadge state={row.state} />
            <div className="text-xs text-[var(--text-muted)]">{minutes === null ? "Sin lecturas" : `Último dato ${formatAgo(minutes)}`}</div>
          </div>
        )}
      </div>
    </Link>
  );
}

/** Portada del productor: primero sus predios y áreas; el resumen de 24 h queda plegado al final. El mapa vive en `/cliente/mapa`. */
export function PropertiesOverview() {
  const { properties, areas, loading: selectionLoading, error: selectionError } = useSelection();
  const { rows, loading, error } = useAreaOverview(areas);
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
  const withRows = properties.map((p) => ({ property: p, rows: rows.filter((r) => r.area.property_id === p.id) })).filter((g) => g.rows.length);
  const maxHectares = Math.max(1, ...withRows.map(({ rows: l }) => l.reduce((sum, r) => sum + (r.area.area_size ?? 0), 0)));
  const okRows = rows.filter((r) => r.state === "al_dia");
  const liters = hourlyLiters(okRows.map((r) => r.series), now);
  const problems = AREA_STATE_ORDER.filter((k) => k !== "al_dia" && summary.counts[k] > 0).map((k) => `${summary.counts[k]} ${AREA_STATE_LABEL[k].toLowerCase()}`);

  return (
    <div className="mx-auto max-w-[1100px] space-y-9 p-4 md:p-8">
      <header>
        <h1 className="text-[22px] font-semibold md:text-2xl">Mis predios</h1>
        <p role="status" className="mt-1 text-base">
          <b className="font-semibold">{summary.reporting} de {summary.total} áreas al día</b>
          {problems.length > 0 && <span className="text-[var(--status-danger-text)]"> · {problems.join(" · ")}</span>}
        </p>
      </header>

      {withRows.map(({ property: p, rows: list }) => {
        const ok = list.filter((r) => r.state === "al_dia").length;
        const bad = list.length - ok;
        const hectares = list.reduce((sum, r) => sum + (r.area.area_size ?? 0), 0);
        // El ancho del plano de cada predio es proporcional a sus hectáreas respecto del mayor.
        const width = Math.max(26, Math.round((hectares / maxHectares) * 100));
        return (
          <section key={p.id} aria-labelledby={`predio-${p.id}`} className="min-w-0">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
                <h2 id={`predio-${p.id}`} className="text-lg font-semibold">{p.name}</h2>
                <p className={`text-sm ${bad ? "font-medium text-[var(--status-danger-text)]" : "text-[var(--text-muted)]"}`}>
                  {hectares > 0 ? `${hectares} ha · ` : ""}{list.length} {list.length === 1 ? "área" : "áreas"}{bad ? ` · ${ok} al día` : ""}
                </p>
              </div>
              <Link to={`/cliente/predio/${p.id}`} aria-label={`Ver el detalle del predio ${p.name}`} className="inline-flex min-h-[44px] items-center gap-0.5 text-sm font-semibold text-[var(--accent-primary)] underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                Detalle del predio<ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
            <div className="flex flex-wrap gap-2" style={{ width: `min(100%, max(${width}%, 340px))` }}>
              {list.map((r) => <AreaTile key={r.area.id} row={r} weight={r.area.area_size ?? 5} now={now} />)}
            </div>
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
