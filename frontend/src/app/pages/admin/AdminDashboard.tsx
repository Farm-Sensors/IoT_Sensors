import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { PageHeader } from "../../components/PageHeader";
import { PageTransition } from "../../components/PageTransition";
import { SkeletonGrid } from "../../components/SkeletonCard";
import { usePageVisibility } from "../../hooks/usePageVisibility";
import { api } from "../../services/api";
import { listGateways } from "../../services/gateways";
import { getGeoNodes } from "../../services/nodes";
import { FocusBlock } from "../../components/FocusBlock";
import { formatAgo } from "../client/overview/areaStatus";
import { buildPending, PENDING_LABEL, PENDING_ORDER, summarizeAreas, type AreaSummary, type PendingItem } from "./today/pending";

/** Los totales se refrescan cada 3 s (igual que antes); los pendientes, cada 30 s. */
const STATS_MS = 3000;
const PENDING_MS = 30_000;


function usePending() {
  const [items, setItems] = useState<PendingItem[] | null>(null);
  const [summary, setSummary] = useState<AreaSummary | null>(null);
  const [error, setError] = useState(false);
  const visible = usePageVisibility();
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const [clients, properties, areas, geo, cycles, gateways] = await Promise.all([
        api.get("/clients?per_page=100"),
        api.get("/properties?per_page=100"),
        api.get("/irrigation-areas?per_page=100"),
        getGeoNodes({ include_without_coordinates: true, per_page: 200 }),
        api.get("/crop-cycles?per_page=200"),
        listGateways(),
      ]);
      const input = {
        clients: clients.data.data, properties: properties.data.data, areas: areas.data.data,
        nodes: geo.data, cycles: cycles.data.data, gateways: gateways.data,
        today: format(new Date(), "yyyy-MM-dd"), formatAgo,
      };
      const built = buildPending(input);
      setItems(built);
      setSummary(summarizeAreas(input));
      setError(false);
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
    if (!visible) return;
    const id = window.setInterval(() => void load(), PENDING_MS);
    return () => window.clearInterval(id);
  }, [load, visible]);

  return { items, summary, error };
}

export function AdminDashboard() {
  const [stats, setStats] = useState({
    clients: 0,
    properties: 0,
    nodesTotal: 0,
    nodesActive: 0,
    readingsToday: 0
  });
  const [offlineNodes, setOfflineNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { items: pending, summary, error: pendingError } = usePending();
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [, tick] = useState(0);
  useEffect(() => { const id = window.setInterval(() => tick((n) => n + 1), 15_000); return () => window.clearInterval(id); }, []);

  useEffect(() => {
    const fetchDashboardData = async (isInitialLoad = false) => {
      try {
        if (isInitialLoad) setLoading(true);

        // Parallel requests for all counts
        const [clientsRes, propsRes, nodesRes, readingsRes] = await Promise.all([
          api.get("/clients?per_page=1"),
          api.get("/properties?per_page=1"),
          api.get("/nodes?per_page=200"), // Get more nodes to find inactive ones
          api.get(`/readings?per_page=1&start_date=${new Date().toISOString().split('T')[0]}`)
        ]);

        const totalClients = clientsRes.data.total || 0;
        const totalProps = propsRes.data.total || 0;
        const totalReadings = readingsRes.data.total || 0;

        const nodesData = nodesRes.data.data || nodesRes.data || [];
        const totalNodes = nodesRes.data.total || nodesData.length || 0;
        const activeNodes = nodesData.filter((n: any) => n.is_active || n.activo).length;
        const inactiveNodes = nodesData.filter((n: any) => !(n.is_active || n.activo));

        const nextStats = {
          clients: totalClients,
          properties: totalProps,
          nodesTotal: totalNodes,
          nodesActive: activeNodes,
          readingsToday: totalReadings
        };

        setUpdatedAt(Date.now());
        setStats((prev) => {
          if (
            prev.clients === nextStats.clients
            && prev.properties === nextStats.properties
            && prev.nodesTotal === nextStats.nodesTotal
            && prev.nodesActive === nextStats.nodesActive
            && prev.readingsToday === nextStats.readingsToday
          ) {
            return prev;
          }
          return nextStats;
        });

        setOfflineNodes((prev) => {
          if (
            prev.length === inactiveNodes.length
            && prev.every((node, index) => node.id === inactiveNodes[index]?.id)
          ) {
            return prev;
          }
          return inactiveNodes;
        });
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        if (isInitialLoad) setLoading(false);
      }
    };

    fetchDashboardData(true);

    // Intervalo para testing en tiempo real
    const intervalId = setInterval(() => {
      fetchDashboardData();
    }, STATS_MS);

    return () => clearInterval(intervalId);
  }, []);

  const minutes = Math.floor((Date.now() - updatedAt) / 60_000);
  const urgent = (pending ?? []).filter((i) => i.kind === "sin_comunicacion" || i.kind === "sin_datos");
  const toSetUp = (pending ?? []).filter((i) => i.kind !== "sin_comunicacion" && i.kind !== "sin_datos");
  const grouped = PENDING_ORDER.map((kind) => ({ kind, list: toSetUp.filter((i) => i.kind === kind) })).filter((g) => g.list.length);
  const setUpCount = toSetUp.length + offlineNodes.length;
  // Todo bien: nada urgente y nada por configurar. En lugar de una pantalla casi vacía, se muestra «Todo en orden» con las cifras.
  const allGood = pending !== null && urgent.length === 0 && setUpCount === 0;
  const actionBtn = "inline-flex h-11 items-center border justify-center rounded-[var(--radius)] px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2";

  return (
    <PageTransition>
      <div className="mx-auto max-w-[1000px] p-4 md:p-8">
        <PageHeader
          title="Inicio"
          subtitle={new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
          action={
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Link to="/admin/clientes" className={`${actionBtn} border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--text-inverted)] hover:opacity-90 sm:w-40`}>Nuevo Cliente</Link>
              <Link to="/admin/nodos" className={`${actionBtn} border-[var(--border-strong)] bg-[var(--card)] hover:bg-[var(--accent-soft)] sm:w-40`}>Nuevo Nodo</Link>
            </div>
          }
        />

        {!loading && summary && (
          <FocusBlock
            className="mt-6"
            value={<>{summary.al_dia}<span className="text-[var(--text-muted)]"> / {summary.total}</span></>}
            label="áreas al día"
            hint={summary.al_dia === summary.total ? "Todos los nodos están enviando datos." : `${summary.total - summary.al_dia} sin datos recientes: revísalas abajo.`}
          />
        )}

        {loading ? (
          <div className="py-12">
            <SkeletonGrid count={4} />
          </div>
        ) : (
          <>
            {allGood && (
              <section aria-labelledby="orden-h" className="mt-8">
                <div className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-5">
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 flex-shrink-0 text-[var(--status-success-solid)]" />
                  <div>
                    <h2 id="orden-h" className="text-xl font-semibold">Todo en orden</h2>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">Todos los nodos están enviando datos y no hay nada por configurar.</p>
                  </div>
                </div>
                <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    { label: stats.clients === 1 ? "Cliente" : "Clientes", value: stats.clients.toLocaleString(), to: "/admin/clientes" },
                    { label: stats.properties === 1 ? "Predio" : "Predios", value: stats.properties.toLocaleString(), to: "/admin/clientes" },
                    { label: "Nodos habilitados", value: `${stats.nodesActive}/${stats.nodesTotal}`, to: "/admin/nodos" },
                    { label: "Lecturas hoy", value: stats.readingsToday.toLocaleString(), to: null },
                  ].map((tile) => {
                    const body = (
                      <>
                        <span className="block text-xs text-[var(--text-muted)]">{tile.label}</span>
                        <span className="block font-mono-data text-2xl font-medium text-[var(--accent-green)]">{tile.value}</span>
                      </>
                    );
                    const box = "block rounded-[var(--radius)] border border-[var(--border)] border-l-[3px] border-l-[var(--brand-green)] bg-[var(--card)] px-4 py-3";
                    return (
                      <li key={tile.label}>
                        {tile.to ? (
                          <Link to={tile.to} className={`${box} hover:bg-[var(--accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]`}>{body}</Link>
                        ) : (
                          <div className={box}>{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 text-sm text-[var(--text-muted)]">Actualizado {minutes < 1 ? "hace un momento" : `hace ${minutes} min`}</p>
              </section>
            )}

            {/* 1. Lo único que afecta al cliente ahora: datos que dejaron de llegar. */}
            {!allGood && <section aria-labelledby="urgente-h" className="mt-8">
              <h2 id="urgente-h" className="mb-3 flex items-baseline gap-3 text-xl font-semibold">
                Datos que dejaron de llegar
                {pending && <span className={`font-mono-data text-base ${urgent.length ? "text-[var(--status-danger-text)]" : "text-[var(--text-muted)]"}`}>{urgent.length}</span>}
              </h2>
              {pendingError && !pending ? (
                <p role="alert" className="text-sm text-[var(--status-danger-text)]">No se pudo revisar la comunicación de los nodos. Se reintentará solo.</p>
              ) : !pending ? (
                <p role="status" className="text-sm text-[var(--text-muted)]">Revisando los nodos…</p>
              ) : urgent.length === 0 ? (
                <p className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-4 text-base">
                  <CheckCircle2 aria-hidden="true" className="h-5 w-5 flex-shrink-0 text-[var(--status-success-solid)]" />
                  Todos los nodos están enviando datos.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] border-l-4 border-l-[var(--status-danger-text)] bg-[var(--card)]">
                  {urgent.map((item) => (
                    <li key={item.key}>
                      <Link to={item.to} className="flex min-h-[72px] items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]">
                        <span className="min-w-0">
                          <span className="block truncate text-base font-semibold">{item.client || item.title}</span>
                          <span className="block truncate text-sm text-[var(--text-muted)]">{item.place ?? item.context}</span>
                        </span>
                        <span className="flex flex-shrink-0 flex-col items-end text-right">
                          <span className="font-mono-data text-sm font-semibold text-[var(--status-danger-text)]">{item.since}</span>
                          <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-[var(--accent-primary)]">{item.action}<ChevronRight aria-hidden="true" className="h-4 w-4" /></span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>}

            {/* 2. Lo que falta configurar: puede esperar, el cliente aún no lo nota. */}
            {pending && setUpCount > 0 && (
              <section aria-labelledby="config-h" className="mt-10">
                <h2 id="config-h" className="mb-3 flex items-baseline gap-3 border-b border-[var(--border)] pb-2 text-lg font-semibold">
                  Por configurar
                  <span className="font-mono-data text-sm font-normal text-[var(--text-muted)]">{setUpCount}</span>
                </h2>
                <div className="space-y-5">
                  {grouped.map(({ kind, list }) => (
                    <div key={kind}>
                      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                        <AlertTriangle aria-hidden="true" className="h-4 w-4 text-[var(--text-muted)]" />
                        {PENDING_LABEL[kind]}
                        <span className="font-mono-data font-normal text-[var(--text-muted)]">{list.length}</span>
                      </h3>
                      <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
                        {list.map((item) => <PendingRow key={item.key} item={item} />)}
                      </ul>
                    </div>
                  ))}
                  {offlineNodes.length > 0 && (
                    <div>
                      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                        <AlertTriangle aria-hidden="true" className="h-4 w-4 text-[var(--text-muted)]" />
                        Nodo deshabilitado
                        <span className="font-mono-data font-normal text-[var(--text-muted)]">{offlineNodes.length}</span>
                      </h3>
                      <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
                        {offlineNodes.map((node) => (
                          <PendingRow key={node.id} item={{ key: `off-${node.id}`, kind: "sin_datos", title: node.name || `Nodo #${node.id}`, context: `Serial: ${node.serial_number || "—"}`, detail: "Está deshabilitado y no envía datos.", to: `/admin/nodos/${node.id}`, action: "Ver nodo" }} />
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 3. Totales: casi nunca cambian lo que se hace, van al final y pequeños. */}
            {!allGood && <p className="mt-10 border-t border-[var(--border)] pt-3 text-sm text-[var(--text-muted)]">
              {stats.clients} {stats.clients === 1 ? "cliente" : "clientes"} · {stats.properties} {stats.properties === 1 ? "predio" : "predios"} · {stats.nodesActive}/{stats.nodesTotal} nodos habilitados · {stats.readingsToday.toLocaleString()} lecturas hoy · Actualizado {minutes < 1 ? "hace un momento" : `hace ${minutes} min`}
            </p>}
          </>
        )}
      </div>
    </PageTransition>
  );
}

function PendingRow({ item }: { item: PendingItem }) {
  return (
    <li>
      <Link to={item.to} className="flex min-h-[56px] items-center justify-between gap-4 px-4 py-2.5 hover:bg-[var(--accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{item.title}</span>
          <span className="block text-xs text-[var(--text-muted)]">{[item.context, item.detail].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="inline-flex flex-shrink-0 items-center gap-0.5 text-sm font-semibold text-[var(--accent-primary)]">{item.action}<ChevronRight aria-hidden="true" className="h-4 w-4" /></span>
      </Link>
    </li>
  );
}
