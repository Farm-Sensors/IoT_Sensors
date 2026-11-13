import { differenceInCalendarDays, format } from "date-fns";
import { ChevronDown, ChevronRight, Eye, MapPin, Search, Sprout, Users, Warehouse } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { Breadcrumbs, type Crumb } from "../../components/Breadcrumbs";
import { EmbeddedPanel } from "../../components/EmbeddedPanel";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { PageHeader } from "../../components/PageHeader";
import { api } from "../../services/api";
import { getGeoNodes, type GeoNode } from "../../services/nodes";
import { areaState, type AreaState } from "../client/overview/areaStatus";
import { parseBackendTimestamp } from "../../utils/datetime";
import { StateBadge } from "../client/overview/OverviewCharts";
import { ClientManagement } from "./ClientManagement";
import { CropCycleManagement } from "./CropCycleManagement";
import { HealthBadge, EMPTY_HEALTH, panelButton, placeLabel, referenceLabel, type Health } from "./directory/Health";
import { formatFreshness, formatMetric } from "../../utils/metricFormat";
import { IrrigationAreaManagement } from "./IrrigationAreaManagement";
import { NodeManagement } from "./NodeManagement";
import { PropertyManagement } from "./PropertyManagement";

interface DClient { id: number; company_name: string }
interface DProperty { id: number; client_id: number; name: string; location: string | null; latitude: number | null; longitude: number | null }
interface DArea { id: number; property_id: number; name: string; area_size: number | null; crop_type: { name: string } | null }
interface DCycle { irrigation_area_id: number; start_date: string; end_date: string | null }
interface Tree { clients: DClient[]; properties: DProperty[]; areas: DArea[]; nodes: GeoNode[]; cycles: DCycle[] }

type Selection = { kind: "none" } | { kind: "client"; id: number } | { kind: "property"; id: number } | { kind: "area"; id: number };
type AreaTab = "resumen" | "ciclos" | "nodo";

async function loadTree(): Promise<Tree> {
  const [clients, properties, areas, geo, cycles] = await Promise.all([
    api.get<{ data: DClient[] }>("/clients?per_page=100"),
    api.get<{ data: DProperty[] }>("/properties?per_page=100"),
    api.get<{ data: DArea[] }>("/irrigation-areas?per_page=100"),
    getGeoNodes({ include_without_coordinates: true, per_page: 200 }),
    api.get<{ data: DCycle[] }>("/crop-cycles?per_page=200"),
  ]);
  return { clients: clients.data.data, properties: properties.data.data, areas: areas.data.data, nodes: geo.data, cycles: cycles.data.data };
}

/** Pausa entre actualizaciones del directorio, igual que Inicio. */
const POLL_MS = 30_000;

/** Árbol cliente › predio › área. Se vuelve a pedir cada 30 s y cuando el panel crea, edita o borra algo. */
function useTree() {
  const [tree, setTree] = useState<Tree | null>(null);
  const [error, setError] = useState(false);
  const reload = useCallback(() => { loadTree().then((t) => { setTree(t); setError(false); }).catch(() => setError(true)); }, []);
  useEffect(() => {
    reload();
    const timer = window.setInterval(reload, POLL_MS);
    // Cualquier escritura (POST, PUT, PATCH, DELETE) hecha por los paneles refresca el árbol.
    const id = api.interceptors.response.use((response) => {
      if (response.config.method && response.config.method.toLowerCase() !== "get") window.setTimeout(reload, 400);
      return response;
    });
    return () => { window.clearInterval(timer); api.interceptors.response.eject(id); };
  }, [reload]);
  return { tree, error, reload };
}

interface AreaInfo { state: AreaState; hasCycle: boolean; node?: GeoNode; cycle?: DCycle }

/** Estado de datos y de configuración de cada área, calculado con lo que ya se carga para el árbol. */
function useDerived(tree: Tree | null) {
  return useMemo(() => {
    const info: Record<number, AreaInfo> = {};
    const propertyHealth: Record<number, Health> = {};
    const clientHealth: Record<number, Health> = {};
    if (!tree) return { info, propertyHealth, clientHealth };
    const today = format(new Date(), "yyyy-MM-dd");
    const nodeByArea = new Map(tree.nodes.map((n) => [n.irrigation_area_id, n]));
    for (const area of tree.areas) {
      const node = nodeByArea.get(area.id);
      const cycle = tree.cycles.filter((c) => c.irrigation_area_id === area.id && (c.end_date === null || c.end_date >= today)).sort((x, y) => y.start_date.localeCompare(x.start_date))[0];
      const last = node?.minutes_since_last_reading != null ? new Date(Date.now() - node.minutes_since_last_reading * 60_000) : null;
      info[area.id] = { state: areaState(Boolean(node), last), hasCycle: Boolean(cycle), node, cycle };
    }
    const add = (map: Record<number, Health>, key: number, i: AreaInfo) => {
      const h = (map[key] ??= { ...EMPTY_HEALTH });
      h.total += 1;
      if (i.state === "sin_comunicacion") h.stale += 1;
      if (i.state === "sin_datos") h.noData += 1;
      if (i.state === "sin_nodo") h.noNode += 1;
      if (!i.hasCycle) h.noCycle += 1;
      if (i.state === "al_dia" && i.hasCycle) h.ok += 1;
    };
    for (const area of tree.areas) {
      add(propertyHealth, area.property_id, info[area.id]);
      const property = tree.properties.find((p) => p.id === area.property_id);
      if (property) add(clientHealth, property.client_id, info[area.id]);
    }
    return { info, propertyHealth, clientHealth };
  }, [tree]);
}

/** Número de áreas con algo pendiente; en rojo si alguna no se comunica. */
function Count({ health }: { health?: Health }) {
  const n = health ? health.total - health.ok : 0;
  if (!n) return null;
  return <span title={`${n} con pendientes`} className={`ml-auto inline-flex min-w-[22px] justify-center rounded-full px-1.5 text-xs font-semibold ${health && health.stale > 0 ? "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]" : "bg-[var(--card-sand)] text-[var(--text-muted)]"}`}><span aria-hidden="true">{n}</span><span className="sr-only">{n} con pendientes</span></span>;
}

function TreeNav({ tree, selection, filter, derived }: { tree: Tree; selection: Selection; filter: string; derived: ReturnType<typeof useDerived> }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const term = filter.trim().toLowerCase();
  const matches = (text: string) => !term || text.toLowerCase().includes(term);
  // `forced` solo es el valor inicial (lo seleccionado se abre); después manda lo que el usuario toque.
  const isOpen = (key: string, forced: boolean) => term !== "" || (open[key] ?? forced);
  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  const selectedProperty = selection.kind === "property" ? selection.id : selection.kind === "area" ? tree.areas.find((a) => a.id === selection.id)?.property_id : undefined;
  const selectedClient = selection.kind === "client" ? selection.id : selectedProperty ? tree.properties.find((p) => p.id === selectedProperty)?.client_id : undefined;

  // Al cambiar la selección se abren sus ancestros; el usuario puede cerrarlos después.
  useEffect(() => {
    setOpen((o) => ({ ...o, ...(selectedClient ? { [`c${selectedClient}`]: true } : {}), ...(selectedProperty ? { [`p${selectedProperty}`]: true } : {}) }));
  }, [selectedClient, selectedProperty]);

  const clients = tree.clients.filter((c) => matches(c.company_name) || tree.properties.some((p) => p.client_id === c.id && (matches(p.name) || tree.areas.some((a) => a.property_id === p.id && matches(a.name)))));
  const rowCls = (current: boolean) => `flex min-h-[44px] flex-1 items-center gap-2 rounded-[var(--radius)] px-2 text-left text-sm transition-colors hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${current ? "bg-[var(--accent-soft)] font-semibold" : ""}`;

  if (!clients.length) return <p className="p-3 text-sm text-[var(--text-muted)]">Ningún resultado.</p>;
  return (
    <ul aria-label="Clientes, predios y áreas" className="space-y-0.5">
      {clients.map((c) => {
        const props = tree.properties.filter((p) => p.client_id === c.id);
        const ck = `c${c.id}`;
        return (
          <li key={c.id}>
            <div className="flex items-center">
              <button type="button" aria-label={isOpen(ck, selectedClient === c.id) ? "Contraer" : "Expandir"} onClick={() => toggle(ck)} className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                {isOpen(ck, selectedClient === c.id) ? <ChevronDown aria-hidden="true" className="h-4 w-4" /> : <ChevronRight aria-hidden="true" className="h-4 w-4" />}
              </button>
              <Link to={`/admin/clientes/${c.id}/predios`} aria-current={selection.kind === "client" && selection.id === c.id ? "page" : undefined} className={rowCls(selection.kind === "client" && selection.id === c.id)}>
                <Users aria-hidden="true" className="h-4 w-4 flex-shrink-0" /><span className="truncate">{c.company_name}</span><Count health={derived.clientHealth[c.id]} />
              </Link>
            </div>
            {isOpen(ck, selectedClient === c.id) && (
              <ul className="ml-4 border-l border-[var(--border)] pl-1">
                {props.map((p) => {
                  const areas = tree.areas.filter((a) => a.property_id === p.id);
                  const pk = `p${p.id}`;
                  return (
                    <li key={p.id}>
                      <div className="flex items-center">
                        <button type="button" aria-label={isOpen(pk, selectedProperty === p.id) ? "Contraer" : "Expandir"} onClick={() => toggle(pk)} className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                          {isOpen(pk, selectedProperty === p.id) ? <ChevronDown aria-hidden="true" className="h-4 w-4" /> : <ChevronRight aria-hidden="true" className="h-4 w-4" />}
                        </button>
                        <Link to={`/admin/predios/${p.id}/areas`} aria-current={selection.kind === "property" && selection.id === p.id ? "page" : undefined} className={rowCls(selection.kind === "property" && selection.id === p.id)}>
                          <MapPin aria-hidden="true" className="h-4 w-4 flex-shrink-0" /><span className="truncate">{p.name}</span><Count health={derived.propertyHealth[p.id]} />
                        </Link>
                      </div>
                      {isOpen(pk, selectedProperty === p.id) && (
                        <ul className="ml-4 border-l border-[var(--border)] pl-1">
                          {areas.map((a) => {
                            const ai = derived.info[a.id];
                            const missing = ai ? [ai.state === "sin_comunicacion" && "sin comunicación", ai.state === "sin_datos" && "sin datos", ai.state === "sin_nodo" && "sin nodo", !ai.hasCycle && "sin ciclo"].filter(Boolean).join(", ") : "";
                            const current = selection.kind === "area" && selection.id === a.id;
                            return (
                              <li key={a.id}>
                                <Link to={`/admin/areas/${a.id}`} aria-current={current ? "page" : undefined} className={`${rowCls(current)} ml-2`}>
                                  <span className="truncate">{a.name}</span>
                                  {missing && <span title={missing} className="ml-auto inline-flex items-center gap-1 text-xs"><span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: ai?.state === "sin_comunicacion" ? "var(--status-danger-text)" : "var(--text-muted)" }} /><span className="sr-only">{missing}</span></span>}
                                </Link>
                              </li>
                            );
                          })}
                          {!areas.length && <li className="py-2 pl-3 text-xs text-[var(--text-muted)]">Sin áreas</li>}
                        </ul>
                      )}
                    </li>
                  );
                })}
                {!props.length && <li className="py-2 pl-3 text-xs text-[var(--text-muted)]">Sin predios</li>}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Fact({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] py-3 last:border-b-0">
      <div className="min-w-0">
        <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
        <dd className="mt-0.5 text-base">{children}</dd>
      </div>
      {action}
    </div>
  );
}

const day = (iso: string) => format(new Date(`${iso}T00:00:00`), "dd/MM/yyyy");

interface Latest { timestamp: string; soil: { humidity: number | null }; irrigation: { flow_per_minute: number | null }; environmental: { eto: number | null } }

/** Última lectura del área (o `null` si nunca ha reportado); se vuelve a pedir cuando cambia la frescura del árbol. */
function useLatest(areaId: number, stamp: string | null | undefined) {
  const [latest, setLatest] = useState<Latest | null>(null);
  useEffect(() => {
    if (!stamp) { setLatest(null); return; }
    let alive = true;
    api.get<Latest | null>(`/readings/latest?irrigation_area_id=${areaId}`).then((r) => { if (alive) setLatest(r.data ?? null); }).catch(() => { if (alive) setLatest(null); });
    return () => { alive = false; };
  }, [areaId, stamp]);
  return latest;
}

function AreaPanel({ area, info, property }: { area: DArea; info?: AreaInfo; property?: DProperty }) {
  const [params, setParams] = useSearchParams();
  const tab: AreaTab = params.get("tab") === "ciclos" ? "ciclos" : params.get("tab") === "nodo" ? "nodo" : "resumen";
  const go = (t: AreaTab) => setParams(t === "resumen" ? {} : { tab: t }, { replace: true });
  const tabs: { id: AreaTab; label: string }[] = [{ id: "resumen", label: "Resumen" }, { id: "ciclos", label: "Ciclos" }, { id: "nodo", label: "Nodo" }];
  const last = parseBackendTimestamp(info?.node?.last_reading_timestamp);
  const latest = useLatest(area.id, info?.node?.last_reading_timestamp);
  const goBtn = (t: AreaTab, text: string) => <button type="button" onClick={() => go(t)} className={panelButton}>{text}</button>;
  const asClient = <Link to={`/admin/areas/${area.id}/ver`} className={panelButton}><Eye aria-hidden="true" className="h-4 w-4" />Ver como el cliente</Link>;

  return (
    <div>
      <IrrigationAreaManagement predioId={String(area.property_id)} areaId={String(area.id)} meta={info ? <span className="inline-flex"><StateBadge state={info.state} /></span> : undefined} />
      <div className="mt-3 flex flex-wrap gap-2">{asClient}</div>
      <div role="tablist" aria-label="Secciones del área" className="mb-4 mt-4 flex gap-1 border-b border-[var(--border)]">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => go(t.id)}
            className={`-mb-px min-h-[44px] border-b-[3px] px-4 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${tab === t.id ? "border-[var(--accent-primary)] font-semibold" : "border-transparent text-[var(--text-muted)]"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "resumen" && (
        <dl>
          <Fact label="Datos">
            {!info || info.state === "sin_nodo" ? "Sin nodo: no llegan datos."
              : info.state === "sin_datos" || !last ? "Sin lecturas todavía: el nodo no ha enviado datos."
              : info.state === "sin_comunicacion" ? <span className="text-[var(--status-danger-text)]">Sin comunicación · {formatFreshness(last)}</span>
              : <>Al día · {formatFreshness(last)}</>}
          </Fact>
          {info && info.state !== "sin_nodo" && (
            <Fact label="Datos prioritarios (última lectura)">
              <span className="flex flex-wrap gap-x-4 gap-y-1">
                <span>Humedad del suelo <span className="font-mono-data font-semibold">{formatMetric("humidity", latest?.soil.humidity)}</span></span>
                <span>Flujo de agua <span className="font-mono-data font-semibold">{formatMetric("flow", latest?.irrigation.flow_per_minute)}</span></span>
                <span>ETO <span className="font-mono-data font-semibold">{formatMetric("eto", latest?.environmental.eto)}</span></span>
              </span>
            </Fact>
          )}
          {property && <Fact label="Predio">{property.name} · {placeLabel(property.location)} · {referenceLabel(property)}</Fact>}
          <Fact label="Ciclo de cultivo" action={goBtn("ciclos", info?.cycle ? "Ver ciclos" : "Crear ciclo")}>
            {info?.cycle
              ? <>Desde <span className="font-mono-data">{day(info.cycle.start_date)}</span> · día <span className="font-mono-data">{differenceInCalendarDays(new Date(), new Date(`${info.cycle.start_date}T00:00:00`)) + 1}</span>{info.cycle.end_date ? <> · termina <span className="font-mono-data">{day(info.cycle.end_date)}</span></> : null}</>
              : "Sin ciclo activo."}
          </Fact>
          <Fact label="Nodo" action={goBtn("nodo", info?.node ? "Ver nodo" : "Registrar nodo")}>
            {info?.node ? <>{info.node.name || info.node.serial_number || `Nodo #${info.node.id}`} · {info.node.is_active ? "habilitado" : "deshabilitado"}</> : "Sin nodo."}
          </Fact>
        </dl>
      )}
      {tab === "ciclos" && <CropCycleManagement areaId={area.id} />}
      {tab === "nodo" && <NodeManagement areaId={area.id} />}
    </div>
  );
}

/** Clientes (Directorio): árbol cliente › predio › área y, a la derecha, el panel de lo seleccionado con su estado y sus acciones. */
export function ClientDirectory() {
  const { clientId, predioId, areaId } = useParams();
  const navigate = useNavigate();
  const { tree, error } = useTree();
  const derived = useDerived(tree);
  const [filter, setFilter] = useState("");

  const selection: Selection = areaId ? { kind: "area", id: Number(areaId) } : predioId ? { kind: "property", id: Number(predioId) } : clientId ? { kind: "client", id: Number(clientId) } : { kind: "none" };
  const area = tree && selection.kind === "area" ? tree.areas.find((a) => a.id === selection.id) : undefined;
  const property = tree && (selection.kind === "property" ? tree.properties.find((p) => p.id === selection.id) : area ? tree.properties.find((p) => p.id === area.property_id) : undefined);
  const client = tree && (selection.kind === "client" ? tree.clients.find((c) => c.id === selection.id) : property ? tree.clients.find((c) => c.id === property.client_id) : undefined);

  // En móvil no hay árbol: la ruta es la forma de subir de nivel.
  const crumbs = useMemo<Crumb[]>(() => {
    if (selection.kind === "none") return [];
    return [
      { label: "Clientes", to: "/admin/clientes", icon: Users },
      ...(client ? [{ label: client.company_name, to: `/admin/clientes/${client.id}/predios`, icon: Warehouse }] : []),
      ...(property && selection.kind !== "client" ? [{ label: property.name, to: `/admin/predios/${property.id}/areas`, icon: MapPin }] : []),
      ...(area ? [{ label: area.name, icon: Sprout }] : []),
    ].map((c, i, all) => (i === all.length - 1 ? { label: c.label, icon: c.icon } : c));
  }, [selection.kind, client, property, area]);

  if (error && !tree) return <div className="p-4 md:p-8"><PageHeader title="Clientes" /><ErrorState message="No se pudo cargar el directorio." onRetry={() => navigate(0)} /></div>;

  const missing = tree && ((selection.kind === "area" && !area) || (selection.kind === "property" && !property) || (selection.kind === "client" && !client));
  const counts = (clientIdForCount?: number, propertyIdForCount?: number) => {
    if (!tree) return "";
    const props = tree.properties.filter((p) => (clientIdForCount ? p.client_id === clientIdForCount : true));
    const areas = tree.areas.filter((a) => (propertyIdForCount ? a.property_id === propertyIdForCount : props.some((p) => p.id === a.property_id)));
    return propertyIdForCount ? `${areas.length} ${areas.length === 1 ? "área" : "áreas"}` : `${props.length} ${props.length === 1 ? "predio" : "predios"} · ${areas.length} ${areas.length === 1 ? "área" : "áreas"}`;
  };
  const metaWithHealth = (text: string, h?: Health) => <span className="inline-flex flex-wrap items-center gap-x-2">{text}<span aria-hidden="true">·</span><HealthBadge health={h} /></span>;

  return (
    <div className="mx-auto max-w-[1400px] p-4 md:p-8">
      <h1 className="mb-4 text-[22px] font-semibold md:text-2xl">Clientes</h1>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-2">
            <label className="relative mb-2 block">
              <span className="sr-only">Buscar en el directorio</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar cliente, predio o área" className="min-h-[44px] w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input-background)] pl-9 pr-3 text-sm" />
            </label>
            {tree ? <TreeNav tree={tree} selection={selection} filter={filter} derived={derived} /> : <p role="status" className="p-3 text-sm text-[var(--text-muted)]">Cargando…</p>}
          </div>
        </aside>

        <EmbeddedPanel>
          <section className="min-w-0 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 md:p-6" aria-label="Detalle de la selección">
            {crumbs.length > 0 && <div className="lg:hidden"><Breadcrumbs items={crumbs} /></div>}
            {missing ? (
              <EmptyState icon={Users} title="No se encontró" description="Ese elemento ya no existe. Elige otro en el directorio." />
            ) : selection.kind === "none" ? (
              <ClientManagement health={derived.clientHealth} />
            ) : selection.kind === "client" ? (
              <>
                <ClientManagement clientId={String(selection.id)} meta={metaWithHealth(counts(selection.id), derived.clientHealth[selection.id])} />
                {(() => {
                  const firstArea = tree?.areas.find((a) => tree.properties.some((p) => p.id === a.property_id && p.client_id === selection.id));
                  return firstArea ? (
                    <div className="mt-3">
                      <Link to={`/admin/areas/${firstArea.id}/ver`} className={panelButton}><Eye aria-hidden="true" className="h-4 w-4" />Ver como el cliente</Link>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">Abre «{firstArea.name}» tal como la ve el cliente; desde cada área puedes ver las demás.</p>
                    </div>
                  ) : null;
                })()}
                <div className="mt-6 border-t border-[var(--border)] pt-4">
                  <PropertyManagement clientId={String(selection.id)} health={derived.propertyHealth} />
                </div>
              </>
            ) : selection.kind === "property" && property ? (
              <>
                <PropertyManagement clientId={String(property.client_id)} propertyId={String(property.id)} meta={metaWithHealth(counts(undefined, property.id), derived.propertyHealth[property.id])} />
                <div className="mt-6 border-t border-[var(--border)] pt-4">
                  <IrrigationAreaManagement predioId={String(property.id)} states={Object.fromEntries(Object.entries(derived.info).map(([id, i]) => [id, { state: i.state, hasCycle: i.hasCycle }]))} />
                </div>
              </>
            ) : area && tree ? (
              <AreaPanel area={area} info={derived.info[area.id]} property={property ?? undefined} key={area.id} />
            ) : (
              <p role="status" className="text-sm text-[var(--text-muted)]">Cargando…</p>
            )}
          </section>
        </EmbeddedPanel>
      </div>
    </div>
  );
}
