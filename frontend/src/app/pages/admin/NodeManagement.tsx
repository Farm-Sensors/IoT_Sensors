import { Pencil, Plus, Radio, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { useEmbedded } from "../../components/EmbeddedPanel";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { StateBadge } from "../client/overview/OverviewCharts";
import { areaState, formatAgo, minutesSince } from "../client/overview/areaStatus";
import { listBox, rowLink } from "./directory/Health";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FormDialog } from "../../components/FormDialog";
import { StatusBadge } from "../../components/StatusBadge";
import { useEffect, useState } from "react";
import { BentoCard } from "../../components/BentoCard";
import { EmptyState } from "../../components/EmptyState";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { useToast } from "../../components/Toast";
import { api } from "../../services/api";
import { getGeoNodes } from "../../services/nodes";
import { formatElapsed, parseBackendTimestamp } from "../../utils/datetime";
import { getErrorMessage } from "../../utils/errors";

interface IrrigationArea {
  id: number;
  property_id: number;
  name: string;
}

interface PropertyOption {
  id: number;
  name: string;
}

const SERIAL_HELP =
  "Opcional. Identificador interno; el nodo físico se vincula desde la pantalla del equipo.";

interface NodeData {
  id: number;
  irrigation_area_id: number;
  serial_number: string | null;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
}

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

/** `areaId`: solo el nodo de esa área (Directorio › Área › Nodo); sin él, todos los nodos. */
export function NodeManagement({ areaId }: { areaId?: number } = {}) {
  const embedded = useEmbedded();
  const { showToast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [areas, setAreas] = useState<IrrigationArea[]>([]);
  const [propertyNames, setPropertyNames] = useState<Record<number, string>>({});
  // Habilitado ≠ reportando: la última lectura dice si el nodo ya envía datos.
  const [lastReadings, setLastReadings] = useState<Record<number, string | null>>({});
  const [editingNode, setEditingNode] = useState<NodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formSerialNumber, setFormSerialNumber] = useState("");
  const [formLat, setFormLat] = useState("");
  const [formLng, setFormLng] = useState("");
  const [formAreaId, setFormAreaId] = useState(areaId ? String(areaId) : "");
  const [editName, setEditName] = useState("");
  const [editSerialNumber, setEditSerialNumber] = useState("");
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [nodesRes, areasRes, propertiesRes, geoRes] = await Promise.all([
        api.get("/nodes?per_page=100"),
        api.get("/irrigation-areas?per_page=100"),
        api.get<{ data: PropertyOption[] }>("/properties?per_page=100"),
        getGeoNodes({ include_without_coordinates: true, per_page: 200 }),
      ]);

      const allNodes: NodeData[] = nodesRes.data.data || nodesRes.data;
      const allAreas: IrrigationArea[] = areasRes.data.data || areasRes.data;
      setNodes(areaId ? allNodes.filter((n) => n.irrigation_area_id === areaId) : allNodes);
      setAreas(areaId ? allAreas.filter((a) => a.id === areaId) : allAreas);
      setPropertyNames(
        Object.fromEntries((propertiesRes.data.data || []).map((p) => [p.id, p.name])),
      );
      setLastReadings(
        Object.fromEntries(geoRes.data.map((node) => [node.id, node.last_reading_timestamp])),
      );
    } catch (err: any) {
      setError(getErrorMessage(err, "Error loading nodes"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [areaId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAreaId) return;

    try {
      setLoading(true);
      setError(null);

      const latitude = parseCoordinateInput(formLat, "Latitud", -90, 90);
      const longitude = parseCoordinateInput(formLng, "Longitud", -180, 180);

      await api.post("/nodes", {
        irrigation_area_id: parseInt(formAreaId),
        name: formName.trim() || null,
        serial_number: formSerialNumber.trim() || null,
        latitude,
        longitude,
        is_active: true,
      });
      showToast("Nodo creado.", "success");
      setShowCreateForm(false);
      setFormName("");
      setFormSerialNumber("");
      setFormLat("");
      setFormLng("");
      setFormAreaId(areaId ? String(areaId) : "");
      await fetchData();
    } catch (err: any) {
      setError(getErrorMessage(err, "Error creating node"));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (node: NodeData) => {
    setEditingNode(node);
    setEditName(node.name || "");
    setEditSerialNumber(node.serial_number || "");
    setEditLat(node.latitude === null ? "" : String(node.latitude));
    setEditLng(node.longitude === null ? "" : String(node.longitude));
    setEditIsActive(Boolean(node.is_active));
    setShowEditForm(true);
    setError(null);
  };

  const closeEditForm = () => {
    setShowEditForm(false);
    setEditingNode(null);
    setEditName("");
    setEditSerialNumber("");
    setEditLat("");
    setEditLng("");
    setEditIsActive(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNode) return;

    try {
      setLoading(true);
      setError(null);

      const latitude = parseCoordinateInput(editLat, "Latitud", -90, 90);
      const longitude = parseCoordinateInput(editLng, "Longitud", -180, 180);

      await api.put(`/nodes/${editingNode.id}`, {
        name: editName.trim() || null,
        serial_number: editSerialNumber.trim() || null,
        latitude,
        longitude,
        is_active: editIsActive,
      });

      showToast("Nodo actualizado correctamente", "success");
      closeEditForm();
      await fetchData();
    } catch (err: any) {
      setError(getErrorMessage(err, "Error updating node"));
    } finally {
      setLoading(false);
    }
  };

  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);
  const handleDelete = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      await api.delete(`/nodes/${id}`);
      showToast("Nodo eliminado correctamente", "success");
      await fetchData();
    } catch (err: any) {
      setError(getErrorMessage(err, "Error deleting node"));
    } finally {
      setLoading(false);
    }
  };

  // "Área · Predio": dos ranchos pueden tener áreas con el mismo nombre.
  const getAreaName = (id: number) => {
    const area = areas.find(a => a.id === id);
    if (!area) return "Desconocida";
    const propertyName = propertyNames[area.property_id];
    return propertyName ? `${area.name} · ${propertyName}` : area.name;
  };

  // Lista de nodos por predio, con lo más grave primero (sin comunicación), no una tabla de 7 columnas.
  const rowsByProperty = (() => {
    const severity = { sin_comunicacion: 0, sin_datos: 1, sin_nodo: 2, al_dia: 3 } as const;
    const items = nodes.map((node) => {
      const area = areas.find((a) => a.id === node.irrigation_area_id);
      const last = parseBackendTimestamp(lastReadings[node.id] ?? null);
      return { node, area, last, state: areaState(true, last), property: area ? propertyNames[area.property_id] ?? "Sin predio" : "Sin predio" };
    });
    const names = Array.from(new Set(items.map((i) => i.property)));
    const groupsList = names.map((name) => ({ name, items: items.filter((i) => i.property === name).sort((a, b) => severity[a.state] - severity[b.state] || (a.last?.getTime() ?? 0) - (b.last?.getTime() ?? 0)) }));
    return groupsList.sort((a, b) => Math.min(...a.items.map((i) => severity[i.state])) - Math.min(...b.items.map((i) => severity[i.state])) || a.name.localeCompare(b.name));
  })();

  if (loading && nodes.length === 0) {
    return (
      <PageTransition>
        <div className="min-h-screen p-4 md:p-6 lg:p-8">
          <div className="mb-6">
            <div className="h-8 w-48 rounded-full animate-pulse bg-[var(--text-main)]/10 mb-2" />
            <div className="h-5 w-64 rounded-full animate-pulse bg-[var(--text-main)]/10 opacity-60" />
          </div>
          <BentoCard variant="light" className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-strong)]">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <th key={i} scope="col" className="py-3 px-4">
                      <div className="h-4 rounded-full animate-pulse bg-[var(--text-main)]/10 opacity-50" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-[var(--bg-base)]/30" : ""}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="py-4 px-4">
                        <div className="h-4 rounded-full animate-pulse bg-[var(--text-main)]/10" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </BentoCard>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <PageHeader
          title={embedded ? "" : "Nodos"}
          action={
            <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
              <Plus aria-hidden="true" className="w-4 h-4 mr-2" />
              Nuevo Nodo
            </PillButton>
          }
        />
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-2xl border border-[var(--status-danger)]/25 bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger-text)]">
          {error}
        </div>
      )}

      {embedded ? (
        nodes.length === 0 && !loading ? (
          <EmptyState icon={Radio} title="Sin nodos registrados" description="Registra el nodo de esta área para empezar a recibir datos." action={{ label: "Registrar nodo", onClick: () => setShowCreateForm(true) }} />
        ) : (
          <ul className="space-y-3">
            {nodes.map((node) => {
              const label = node.name || node.serial_number || `Nodo #${node.id}`;
              const last = lastReadings[node.id];
              return (
                <li key={node.id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{label}</p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {last ? `Último dato ${formatElapsed(parseBackendTimestamp(last)).toLowerCase()}` : "Aún sin datos"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <StatusBadge tone={node.is_active ? "active" : "danger"} icon={node.is_active ? CheckCircle2 : XCircle}>{node.is_active ? "Habilitado" : "Deshabilitado"}</StatusBadge>
                      <button type="button" onClick={() => handleOpenEdit(node)} aria-label={`Editar el nodo ${label}`} title="Editar nodo" className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius)] hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><Pencil aria-hidden="true" className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setPendingDelete({ id: node.id, name: label })} aria-label={`Eliminar el nodo ${label}`} title="Eliminar nodo" className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius)] hover:bg-[var(--status-danger-bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><Trash2 aria-hidden="true" className="h-4 w-4 text-[var(--status-danger-text)]" /></button>
                    </div>
                  </div>
                  <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                    {node.serial_number && <div><dt className="text-xs text-[var(--text-muted)]">Número de serie</dt><dd className="font-mono-data">{node.serial_number}</dd></div>}
                    <div><dt className="text-xs text-[var(--text-muted)]">Coordenadas</dt><dd className="font-mono-data">{node.latitude !== null && node.longitude !== null ? `${Math.abs(node.latitude).toFixed(4)}° ${node.latitude >= 0 ? "N" : "S"}, ${Math.abs(node.longitude).toFixed(4)}° ${node.longitude >= 0 ? "E" : "O"}` : "No configuradas"}</dd></div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )
      ) : nodes.length === 0 && !loading ? (
        <EmptyState icon={Radio} title="Sin nodos registrados" description="Registra tu primer sensor para comenzar a recopilar datos de riego." action={{ label: "Crear primer nodo", onClick: () => setShowCreateForm(true) }} />
      ) : (
        <div className="space-y-6">
          {rowsByProperty.map((group) => (
            <section key={group.name} aria-label={group.name}>
              <h2 className="group-title mb-1 text-sm">{group.name}<span className="font-mono-data font-normal text-[var(--text-muted)]">{group.items.length}</span></h2>
              <ul className={listBox}>
                {group.items.map(({ node, area, last, state }) => {
                  const label = node.name || node.serial_number || `Nodo #${node.id}`;
                  return (
                    <li key={node.id} data-tone={state === "sin_comunicacion" ? "bad" : state === "al_dia" ? "ok" : "muted"} className="flex items-stretch">
                      <Link to={`/admin/nodos/${node.id}`} className={`${rowLink} min-w-0 flex-1`}>
                        <span className="min-w-0 flex-1 max-sm:basis-full">
                          <span className="block truncate font-semibold">{area?.name ?? "Área desconocida"}</span>
                          <span className="block truncate text-sm text-[var(--text-muted)]">{label}{!node.is_active ? " · deshabilitado" : ""}</span>
                        </span>
                        <span className="flex w-[11rem] flex-shrink-0 flex-col items-start max-sm:w-auto">
                          <StateBadge state={state} />
                          <span className="text-xs text-[var(--text-muted)]">{last ? formatAgo(minutesSince(last)) : "sin lecturas"}</span>
                        </span>
                        <ChevronRight aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />
                      </Link>
                      <div className="flex items-center gap-1 border-l border-[var(--border)] px-2">
                        <button type="button" onClick={() => handleOpenEdit(node)} aria-label={`Editar el nodo ${label}`} title="Editar nodo" className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius)] hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><Pencil aria-hidden="true" className="h-4 w-4" /></button>
                        <button type="button" onClick={() => setPendingDelete({ id: node.id, name: label })} aria-label={`Eliminar el nodo ${label}`} title="Eliminar nodo" className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius)] hover:bg-[var(--status-danger-bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><Trash2 aria-hidden="true" className="h-4 w-4 text-[var(--status-danger-text)]" /></button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (<FormDialog open title="Nuevo Nodo IoT" onClose={() => setShowCreateForm(false)}>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="node-create-area" className="block text-sm text-[var(--text-subtle)] mb-2">Área de Riego (Obligatorio)</label>
                <select
                  id="node-create-area"
                  required
                  value={formAreaId}
                  onChange={(e) => setFormAreaId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                >
                  <option value="">Seleccione un área</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>{getAreaName(a.id)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="node-create-name" className="block text-sm text-[var(--text-subtle)] mb-2">Nombre del Nodo</label>
                <input
                  id="node-create-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Sensor Nogal-01"
                  className="w-full px-4 py-2.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
              </div>

              <div>
                <label htmlFor="node-create-serial" className="block text-sm text-[var(--text-subtle)] mb-2">Número de Serie</label>
                <input
                  id="node-create-serial"
                  aria-describedby="node-create-serial-help"
                  type="text"
                  value={formSerialNumber}
                  onChange={(e) => setFormSerialNumber(e.target.value)}
                  placeholder="SN-2026-001"
                  className="w-full px-4 py-2.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
                <p id="node-create-serial-help" className="mt-1 text-xs text-[var(--text-subtle)]">
                  {SERIAL_HELP}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="node-create-lat" className="block text-sm text-[var(--text-subtle)] mb-2">Latitud GPS (opcional)</label>
                  <input
                    id="node-create-lat"
                    type="number"
                    step="any"
                    value={formLat}
                    onChange={(e) => setFormLat(e.target.value)}
                    placeholder="28.6329"
                    className="w-full px-4 py-2.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                  />
                </div>
                <div>
                  <label htmlFor="node-create-lng" className="block text-sm text-[var(--text-subtle)] mb-2">Longitud GPS (opcional)</label>
                  <input
                    id="node-create-lng"
                    type="number"
                    step="any"
                    value={formLng}
                    onChange={(e) => setFormLng(e.target.value)}
                    placeholder="-106.0691"
                    className="w-full px-4 py-2.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <PillButton variant="secondary" type="button" className="flex-1" onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </PillButton>
                <PillButton variant="primary" type="submit" className="flex-1" disabled={loading}>
                  {loading ? 'Guardando...' : 'Crear Nodo'}
                </PillButton>
              </div>
            </form>
          </FormDialog>)}

      {/* Edit form */}
      {showEditForm && editingNode && (<FormDialog open title="Editar Nodo IoT" onClose={closeEditForm}>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label htmlFor="node-edit-area" className="block text-sm text-[var(--text-subtle)] mb-2">Área de Riego</label>
                <input
                  id="node-edit-area"
                  type="text"
                  value={getAreaName(editingNode.irrigation_area_id)}
                  readOnly
                  className="w-full px-4 py-2.5 rounded-[var(--radius)] bg-[var(--surface-card-primary)] border border-[var(--border-strong)] text-[var(--text-subtle)]"
                />
              </div>

              <div>
                <label htmlFor="node-edit-name" className="block text-sm text-[var(--text-subtle)] mb-2">Nombre del Nodo</label>
                <input
                  id="node-edit-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ej: Sensor Nogal-01"
                  className="w-full px-4 py-2.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
              </div>

              <div>
                <label htmlFor="node-edit-serial" className="block text-sm text-[var(--text-subtle)] mb-2">Número de Serie</label>
                <input
                  id="node-edit-serial"
                  aria-describedby="node-edit-serial-help"
                  type="text"
                  value={editSerialNumber}
                  onChange={(e) => setEditSerialNumber(e.target.value)}
                  placeholder="SN-2026-001"
                  className="w-full px-4 py-2.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
                <p id="node-edit-serial-help" className="mt-1 text-xs text-[var(--text-subtle)]">
                  {SERIAL_HELP}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="node-edit-lat" className="block text-sm text-[var(--text-subtle)] mb-2">Latitud GPS (opcional)</label>
                  <input
                    id="node-edit-lat"
                    type="number"
                    step="any"
                    value={editLat}
                    onChange={(e) => setEditLat(e.target.value)}
                    placeholder="28.6329"
                    className="w-full px-4 py-2.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                  />
                </div>
                <div>
                  <label htmlFor="node-edit-lng" className="block text-sm text-[var(--text-subtle)] mb-2">Longitud GPS (opcional)</label>
                  <input
                    id="node-edit-lng"
                    type="number"
                    step="any"
                    value={editLng}
                    onChange={(e) => setEditLng(e.target.value)}
                    placeholder="-106.0691"
                    className="w-full px-4 py-2.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                  />
                </div>
              </div>

              <div>
                <label className="inline-flex items-center gap-2 text-sm text-[var(--text-subtle)]">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="accent-[var(--accent-primary)]"
                  />
                  Nodo habilitado
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <PillButton variant="secondary" type="button" className="flex-1" onClick={closeEditForm}>
                  Cancelar
                </PillButton>
                <PillButton variant="primary" type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Guardando..." : "Guardar Cambios"}
                </PillButton>
              </div>
            </form>
          </FormDialog>)}
      <ConfirmDialog
        open={pendingDelete !== null}
        variant="danger"
        title={`¿Eliminar el nodo ${pendingDelete?.name ?? ""}?`}
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (target) void handleDelete(target.id);
        }}
        onCancel={() => setPendingDelete(null)}
      />

    </div>
    </PageTransition>
  );
}
