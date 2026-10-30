import { AlertCircle, Database, MapPin, Plus, Radio, Users, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { BentoCard } from "../../components/BentoCard";
import { PageHeader } from "../../components/PageHeader";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { SkeletonGrid } from "../../components/SkeletonCard";
import { StatusBadge } from "../../components/StatusBadge";
import { api } from "../../services/api";

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
    }, 3000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <PageTransition>
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <PageHeader
          title="Panel de Administración"
          subtitle={new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        />
      </div>

      {loading ? (
        <div className="py-12">
          <SkeletonGrid count={4} />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <BentoCard variant="sand">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-[24px] bg-[var(--accent-primary)]">
                  <Users aria-hidden="true" className="w-6 h-6 text-[var(--text-inverted)]" />
                </div>
              </div>
              <p className="text-sm text-[var(--text-subtle)] mb-1">Total Clientes</p>
              <p className="text-3xl font-bold font-mono-data text-[var(--text-body)]">{stats.clients}</p>
            </BentoCard>

            <BentoCard variant="sand">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-[24px] bg-[var(--accent-primary)]">
                  <MapPin aria-hidden="true" className="w-6 h-6 text-[var(--text-inverted)]" />
                </div>
              </div>
              <p className="text-sm text-[var(--text-subtle)] mb-1">Total Predios</p>
              <p className="text-3xl font-bold font-mono-data text-[var(--text-body)]">{stats.properties}</p>
            </BentoCard>

            <BentoCard variant="sand">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-[24px] bg-[var(--accent-primary)]">
                  <Radio aria-hidden="true" className="w-6 h-6 text-[var(--text-inverted)]" />
                </div>
              </div>
              <p className="text-sm text-[var(--text-subtle)] mb-1">Nodos Habilitados</p>
              <p className="text-3xl font-bold font-mono-data text-[var(--text-body)]">
                {stats.nodesActive}/{stats.nodesTotal}
              </p>
            </BentoCard>

            <BentoCard variant="sand">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-[24px] bg-[var(--accent-primary)]">
                  <Database aria-hidden="true" className="w-6 h-6 text-[var(--text-inverted)]" />
                </div>
              </div>
              <p className="text-sm text-[var(--text-subtle)] mb-1">Lecturas Hoy</p>
              <p className="text-3xl font-bold font-mono-data text-[var(--text-body)]">
                {stats.readingsToday.toLocaleString()}
              </p>
            </BentoCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Alerts section */}
            <div className="lg:col-span-2">
              <BentoCard variant="light">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg text-[var(--text-title)]">Nodos Deshabilitados</h2>
                  <StatusBadge tone={offlineNodes.length > 0 ? "danger" : "neutral"} icon={AlertCircle}>
                    {offlineNodes.length}
                  </StatusBadge>
                </div>

                <div className="space-y-3">
                  {offlineNodes.map((node) => (
                    <div key={node.id} className="p-4 rounded-[24px] bg-[var(--surface-card-primary)] border-l-4 border-[var(--status-danger)]">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-medium text-[var(--text-body)]">{node.name || `Nodo #${node.id}`}</h3>
                          <p className="text-sm text-[var(--text-subtle)]">Serial: {node.serial_number || '-'}</p>
                        </div>
                        <StatusBadge tone="danger" icon={XCircle}>Deshabilitado</StatusBadge>
                      </div>
                    </div>
                  ))}
                  {offlineNodes.length === 0 && (
                    <p className="text-sm text-[var(--text-subtle)]">Todos los nodos registrados están habilitados.</p>
                  )}
                </div>
              </BentoCard>
            </div>

            {/* Quick Actions & Recent Activity */}
            <div className="space-y-6">
              <BentoCard variant="light">
                <h2 className="text-lg text-[var(--text-title)] mb-6">Acciones Rápidas</h2>
                <div className="space-y-3">
                  <Link to="/admin/clientes" className="block">
                    <PillButton variant="primary" className="w-full justify-center">
                      <Plus aria-hidden="true" className="w-4 h-4 mr-2" />
                      Nuevo Cliente
                    </PillButton>
                  </Link>
                  <Link to="/admin/nodos" className="block">
                    <PillButton variant="secondary" className="w-full justify-center">
                      <Plus aria-hidden="true" className="w-4 h-4 mr-2" />
                      Nuevo Nodo
                    </PillButton>
                  </Link>
                  <Link to="/admin/umbrales" className="block">
                    <PillButton variant="secondary" className="w-full justify-center">
                      Configurar Umbrales
                    </PillButton>
                  </Link>
                </div>
              </BentoCard>

              <BentoCard variant="sand">
                <h2 className="text-lg text-[var(--text-title)] mb-4">Actividad Reciente</h2>
                <div className="space-y-3">
                  <p className="text-sm text-[var(--text-subtle)]">
                    Consulta la bitácora completa de eventos administrativos y operativos.
                  </p>
                  <Link to="/admin/auditoria" className="block">
                    <PillButton variant="secondary" className="w-full justify-center">
                      Ver Auditoría
                    </PillButton>
                  </Link>
                </div>
              </BentoCard>
            </div>
          </div>
        </>
      )}
      </div>
    </PageTransition>
  );
}
