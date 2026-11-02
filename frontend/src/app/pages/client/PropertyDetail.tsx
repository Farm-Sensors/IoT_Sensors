import { ChevronRight, MapPin, Warehouse } from "lucide-react";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { Link, Navigate, useParams } from "react-router";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { GatewayStatusBadge } from "../../components/GatewayStatusBadge";
import { SkeletonCard } from "../../components/SkeletonCard";
import { useSelection } from "../../context/SelectionContext";
import { usePropertyGatewayStatus } from "../../hooks/usePropertyGatewayStatus";
import { formatAgo, minutesSince } from "./overview/areaStatus";
import { StateBadge } from "./overview/OverviewCharts";
import { useAreaOverview, type AreaOverviewRow } from "./overview/useAreaOverview";

function Small({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      {value === null ? <span title="Sin dato">—<span className="sr-only"> sin dato</span></span> : (
        <span className="font-mono-data text-base font-medium">{value.toFixed(1)}<small className="ml-1 text-xs text-[var(--text-muted)]">{unit}</small></span>
      )}
    </div>
  );
}

/** Una tarjeta por área: humedad con su nivel y tendencia, flujo y E.T.O.; toda la tarjeta abre el área. */
function AreaCard({ row, now }: { row: AreaOverviewRow; now: number }) {
  const ok = row.state === "al_dia" && row.humidity !== null;
  const minutes = row.lastUpdate ? minutesSince(row.lastUpdate, now) : null;
  const detail = [row.area.crop_type?.name, row.area.area_size ? `${row.area.area_size} ha` : null].filter(Boolean).join(" · ");
  return (
    <Link
      to={`/cliente/area/${row.area.id}`}
      aria-label={`Abrir ${row.area.name}`}
      className={`group flex flex-col gap-4 rounded-[var(--radius)] border bg-[var(--card)] p-4 transition-colors hover:border-[var(--accent-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${ok ? "border-[var(--border-strong)]" : "border-l-4 border-[var(--border-strong)] border-l-[var(--status-danger-text)]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">{row.area.name}</div>
          <div className="truncate text-sm text-[var(--text-muted)]">{detail}</div>
        </div>
        <div className="flex-shrink-0 text-right">
          <StateBadge state={row.state} />
          {!ok && <div className="text-xs text-[var(--text-muted)]">{minutes === null ? "Sin lecturas" : formatAgo(minutes)}</div>}
        </div>
      </div>

      <div>
        <div className="flex items-end justify-between gap-4">
          <div className={ok ? "" : "text-[var(--text-muted)]"}>
            <div className="text-xs text-[var(--text-muted)]">Humedad del suelo</div>
            {row.humidity === null ? <span className="text-2xl" title="Sin dato">—</span> : (
              <span className="font-mono-data text-[34px] font-medium leading-tight">{row.humidity.toFixed(1)}<small className="ml-1 text-sm text-[var(--text-muted)]">%</small></span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 border-t border-[var(--border)] pt-3">
        <div className="flex gap-6">
          <Small label="Flujo" value={row.flow} unit="L/min" />
          <Small label="E.T.O." value={row.eto} unit="mm/d" />
        </div>
        <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-[var(--accent-primary)]">Abrir<ChevronRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
      </div>
    </Link>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="px-5 py-4">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="font-mono-data mt-1 text-[28px] font-medium leading-tight">{value}</div>
      {note && <div className="mt-0.5 text-xs text-[var(--text-muted)]">{note}</div>}
    </div>
  );
}

/**
 * Detalle de UN predio: sus áreas con todas las mediciones (humedad, flujo, E.T.O.), estado y último dato.
 * La portada «Mis predios» es el plano de todos; aquí se ve un predio completo y se entra a cada área.
 */
export function PropertyDetail() {
  const { predioId } = useParams();
  const { properties, areas, loading: selectionLoading, error: selectionError } = useSelection();
  const property = properties.find((p) => p.id === Number(predioId));
  const propertyAreas = areas.filter((a) => a.property_id === property?.id);
  const { rows, loading, error } = useAreaOverview(propertyAreas);
  const gateway = usePropertyGatewayStatus(property?.id);
  const now = Date.now();

  if (selectionLoading || (property && loading)) return <div className="p-4 md:p-8"><SkeletonCard lines={4} /></div>;
  if (selectionError || error) return <div className="p-4 md:p-8"><ErrorState message={selectionError ?? error ?? ""} /></div>;
  if (!property) return <Navigate to="/cliente" replace />;

  const ok = rows.filter((r) => r.state === "al_dia").length;
  const okRows = rows.filter((r) => r.state === "al_dia");
  const flows = okRows.map((r) => r.flow).filter((f): f is number => f !== null);
  const flowNow = flows.length ? flows.reduce((x, y) => x + y, 0) : null;
  const irrigating = okRows.filter((r) => r.irrigating).length;
  const hectares = propertyAreas.reduce((sum, a) => sum + (a.area_size ?? 0), 0);

  return (
    <div className="mx-auto max-w-[1100px] p-4 md:p-8">
      <Breadcrumbs items={[
        { label: "Mis predios", to: "/cliente", icon: Warehouse },
        { label: property.name, icon: MapPin },
      ]} />
      <h1 className="text-[22px] font-semibold md:text-2xl">{property.name}</h1>
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
        {property.location && !/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(property.location.trim()) && (
          <span className="inline-flex items-center gap-1"><MapPin aria-hidden="true" className="h-4 w-4" />{property.location}</span>
        )}
        <span>{hectares > 0 ? `${hectares} ha · ` : ""}{propertyAreas.length} {propertyAreas.length === 1 ? "área" : "áreas"} · {ok} al día</span>
        {gateway && ["delayed", "stale", "disconnected"].some((s) => s === gateway.status || s === gateway.edge_status) && <GatewayStatusBadge status={gateway.status} edgeStatus={gateway.edge_status} />}
      </p>

      {propertyAreas.length === 0 ? (
        <div className="mt-8"><EmptyState icon={MapPin} title="Sin áreas de riego" description="Este predio todavía no tiene áreas. Contacta al administrador." /></div>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-1 divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Fact label="Áreas al día" value={`${ok} de ${propertyAreas.length}`} note={ok < propertyAreas.length ? "las demás no reportan" : "todas reportan"} />
            <Fact label="Flujo ahora" value={flowNow === null ? "—" : `${flowNow.toFixed(1)} L/min`} note="suma de las áreas al día" />
            <Fact label="Riego encendido" value={`${irrigating} de ${okRows.length}`} note="áreas al día regando" />
          </dl>

          <h2 className="mb-3 mt-8 text-lg font-semibold">Áreas de riego</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((r) => <AreaCard key={r.area.id} row={r} now={now} />)}
          </div>

        </>
      )}
    </div>
  );
}
