import { CheckCircle2, MapPin, XCircle } from "lucide-react";
import { FormDialog } from "../../components/FormDialog";
import { Field } from "../../components/Field";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BentoCard } from "../../components/BentoCard";
import { FreshnessIndicator } from "../../components/FreshnessIndicator";
import { Disclosure } from "../../components/Disclosure";
import { ErrorState } from "../../components/ErrorState";
import { GatewayStatusBadge } from "../../components/GatewayStatusBadge";
import { HierarchyTrail } from "../../components/HierarchyTrail";
import { PageHeader } from "../../components/PageHeader";
import { SkeletonCard } from "../../components/SkeletonCard";
import { StatusBadge } from "../../components/StatusBadge";
import { MetricCard } from "../../components/MetricCard";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { useToast } from "../../components/Toast";
import { api } from "../../services/api";
import { getErrorMessage } from "../../utils/errors";
import { parseBackendTimestamp } from "../../utils/datetime";

function parseCoordinateInput(
  value: string,
  label: string,
  min: number,
  max: number
): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const numericValue = Number(trimmed);
  if (Number.isNaN(numericValue)) {
    throw new Error(`${label} debe ser un número válido.`);
  }
  if (numericValue < min || numericValue > max) {
    throw new Error(`${label} debe estar entre ${min} y ${max}.`);
  }
  return numericValue;
}

export function NodeDetail() {
  const { nodeId } = useParams();
  const { showToast } = useToast();

  const [node, setNode] = useState<any>(null);
  const [area, setArea] = useState<any>(null);
  const [latestReading, setLatestReading] = useState<any>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);

  const [showEditForm, setShowEditForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSerialNumber, setEditSerialNumber] = useState("");
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  useEffect(() => {
    const fetchNodeData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch Node
        const nodeRes = await api.get(`/nodes/${nodeId}`);
        const nodeData = nodeRes.data.data || nodeRes.data;
        setNode(nodeData);

        // 2. Fetch Area if linked
        if (nodeData.irrigation_area_id) {
          try {
            const areaRes = await api.get(`/irrigation-areas/${nodeData.irrigation_area_id}`);
            setArea(areaRes.data.data || areaRes.data);
          } catch (e) {
            console.error("Area fetching error", e);
          }

          // 3. Fetch latest reading
          try {
            const latestRes = await api.get(`/readings/latest?irrigation_area_id=${nodeData.irrigation_area_id}`);
            setLatestReading(latestRes.data.data || latestRes.data);
          } catch (e) {
            console.error("Latest reading error", e);
          }

          // 4. Fetch historical for chart (last 24 periods ~ 144 points for 10 min intervals)
          try {
            const histRes = await api.get(`/readings?irrigation_area_id=${nodeData.irrigation_area_id}&per_page=144`);
            const readings = histRes.data.data || histRes.data || [];

            // Sort ascending by time
            const sorted = [...readings].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            const chartData = sorted.map((r: any) => ({
              time: new Date(r.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
              soilHumidity: r.soil?.humidity ?? null
            }));

            setHistoricalData(chartData);
          } catch (e) {
             console.error("Historical data error", e);
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || "Error al cargar información del nodo.");
      } finally {
        setLoading(false);
      }
    };

    if (nodeId) {
      fetchNodeData();
    }
  }, [nodeId]);

  if (loading) {
    return (
      <PageTransition>
        <div className="min-h-screen p-4 md:p-6 lg:p-8">
          <SkeletonCard lines={4} />
        </div>
      </PageTransition>
    );
  }

  if (error || !node) {
    return (
      <PageTransition>
        <div className="min-h-screen p-4 md:p-6 lg:p-8">
          <BentoCard variant="light">
            <ErrorState message={error || "Nodo no encontrado"} />
            <div className="flex justify-center pb-6">
              <Link to="/admin/nodos" className="inline-flex min-h-[44px] items-center text-[var(--accent-primary)] underline">Volver a nodos</Link>
            </div>
          </BentoCard>
        </div>
      </PageTransition>
    );
  }

  const isNodeActive = node.is_active || node.activo;
  const lastUpdate = parseBackendTimestamp(latestReading?.timestamp);

  const openEditForm = () => {
    setEditName(node.name || "");
    setEditSerialNumber(node.serial_number || "");
    setEditLat(node.latitude === null ? "" : String(node.latitude));
    setEditLng(node.longitude === null ? "" : String(node.longitude));
    setEditIsActive(Boolean(node.is_active ?? node.activo));
    setShowEditForm(true);
    setError(null);
  };

  const closeEditForm = () => {
    setShowEditForm(false);
    setEditName("");
    setEditSerialNumber("");
    setEditLat("");
    setEditLng("");
    setEditIsActive(true);
  };

  const handleUpdateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!node) return;

    try {
      setSavingEdit(true);
      setError(null);

      const latitude = parseCoordinateInput(editLat, "Latitud", -90, 90);
      const longitude = parseCoordinateInput(editLng, "Longitud", -180, 180);

      const response = await api.put(`/nodes/${node.id}`, {
        name: editName.trim() || null,
        serial_number: editSerialNumber.trim() || null,
        latitude,
        longitude,
        is_active: editIsActive,
      });

      const updatedNode = response.data.data || response.data;
      setNode(updatedNode);
      showToast("Nodo actualizado correctamente", "success");
      closeEditForm();
    } catch (err: any) {
      setError(getErrorMessage(err, "No se pudo actualizar el nodo."));
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <PageTransition>
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <HierarchyTrail
          items={[
            { label: "Nodos", to: "/admin/nodos" },
            { label: node.name || `Nodo #${node.id}` },
          ]}
        />
        <PageHeader
          title={node.name || `Nodo #${node.id}`}
          subtitle={area?.nombre || area?.name ? `Área: ${area?.nombre || area?.name}` : "Sin área vinculada"}
          action={
            <PillButton type="button" variant="primary" onClick={openEditForm}>
              Editar nodo
            </PillButton>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Node info */}
        <BentoCard variant="light">
          <h2 className="text-lg font-serif text-[var(--text-title)] mb-4">Información del Nodo</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-[var(--text-subtle)] mb-1">Área Vinculada</p>
              <p className="font-medium text-[var(--text-main)]">
                {area?.nombre || area?.name || <span className="italic text-[var(--text-subtle)]">Sin vincular</span>}
              </p>
            </div>

            <div>
              <p className="text-sm text-[var(--text-subtle)] mb-1">Estado</p>
              <StatusBadge tone={isNodeActive ? "active" : "danger"} icon={isNodeActive ? CheckCircle2 : XCircle}>
                {isNodeActive ? "Activo" : "Inactivo"}
              </StatusBadge>
            </div>

            <div>
              <p className="text-sm text-[var(--text-subtle)] mb-1">Coordenadas GPS</p>
              <div className="flex items-center gap-2">
                <MapPin aria-hidden="true" className="w-4 h-4 text-[var(--text-subtle)]" />
                <p className="font-mono text-sm text-[var(--text-main)]">
                  {(node.latitude !== null && node.longitude !== null)
                    ? `${node.latitude}, ${node.longitude}`
                    : 'No configurado'
                  }
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {lastUpdate && <FreshnessIndicator lastUpdate={lastUpdate} />}
              <GatewayStatusBadge />
            </div>

            <Disclosure summary="Datos para soporte">
              <dl className="space-y-2 font-mono text-[var(--text-main)]">
                <div><dt className="font-sans text-[var(--text-subtle)]">Número de serie</dt><dd>{node.serial_number || "-"}</dd></div>
                <div><dt className="font-sans text-[var(--text-subtle)]">ID del nodo</dt><dd>{node.id}</dd></div>
              </dl>
            </Disclosure>
          </div>
        </BentoCard>
      </div>

      {/* Real-time data */}
      <div className="mb-4">
        <h2 className="text-xl font-serif text-[var(--text-title)] mb-4">Datos en Tiempo Real</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <MetricCard
          title="Humedad del Suelo"
          value={latestReading?.soil?.humidity ?? "Sin datos"}
          unit="%"
          variant="dark"
        />

        <MetricCard
          title="Flujo de Agua"
          value={latestReading?.irrigation?.flow_per_minute ?? "Sin datos"}
          unit="L/min"
          variant="dark"
        />

        <MetricCard
          title="E.T.O."
          value={latestReading?.environmental?.eto ?? "Sin datos"}
          unit="mm/día"
          variant="dark"
        />
      </div>

      {/* Chart */}
      <BentoCard variant="light">
        <h2 className="text-lg font-serif text-[var(--text-title)] mb-6">Humedad del Suelo - Últimas Lecturas</h2>
        <div className="h-[300px] min-h-[300px]">
          {historicalData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData}>
                <defs>
                  <linearGradient id="colorHumidity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong)" />
                <XAxis
                  dataKey="time"
                  stroke="var(--text-subtle)"
                  style={{ fontSize: '12px' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="var(--text-subtle)"
                  style={{ fontSize: '12px' }}
                  domain={[30, 60]} // Adjust bounds automatically might be better but maintaining mock layout
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-elevated)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: '16px',
                    padding: '12px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="soilHumidity"
                  stroke="var(--accent-primary)"
                  strokeWidth={3}
                  fill="url(#colorHumidity)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--text-subtle)]">
              {latestReading ? "Cargando histórico..." : "Sin datos históricos registrados."}
            </div>
          )}
        </div>
      </BentoCard>

      {showEditForm && (<FormDialog open title="Editar Nodo IoT" onClose={closeEditForm}>
            <form onSubmit={handleUpdateNode} className="space-y-4">
              <Field label="Nombre del Nodo"><input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ej: Sensor Nogal-01"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                /></Field>

              <Field label="Número de Serie"><input
                  type="text"
                  value={editSerialNumber}
                  onChange={(e) => setEditSerialNumber(e.target.value)}
                  placeholder="SN-2026-001"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                /></Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitud GPS"><input
                    type="number"
                    step="any"
                    value={editLat}
                    onChange={(e) => setEditLat(e.target.value)}
                    placeholder="28.6329"
                    className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                  /></Field>
                <Field label="Longitud GPS"><input
                    type="number"
                    step="any"
                    value={editLng}
                    onChange={(e) => setEditLng(e.target.value)}
                    placeholder="-106.0691"
                    className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                  /></Field>
              </div>

              <div>
                <label className="inline-flex items-center gap-2 text-sm text-[var(--text-subtle)]">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="accent-[var(--accent-primary)]"
                  />
                  Nodo activo
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <PillButton type="button" variant="secondary" className="flex-1" onClick={closeEditForm}>
                  Cancelar
                </PillButton>
                <PillButton type="submit" variant="primary" className="flex-1" disabled={savingEdit}>
                  {savingEdit ? "Guardando..." : "Guardar Cambios"}
                </PillButton>
              </div>
            </form>
          </FormDialog>)}
    </div>
    </PageTransition>
  );
}
