import { Pencil, Plus, Radio, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { BentoCard } from "../../components/BentoCard";
import { EmptyState } from "../../components/EmptyState";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { useToast } from "../../components/Toast";
import { api } from "../../services/api";
import { getErrorMessage } from "../../utils/errors";

interface IrrigationArea {
  id: number;
  name: string;
}

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

export function NodeManagement() {
  const { showToast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [areas, setAreas] = useState<IrrigationArea[]>([]);
  const [editingNode, setEditingNode] = useState<NodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formSerialNumber, setFormSerialNumber] = useState("");
  const [formLat, setFormLat] = useState("");
  const [formLng, setFormLng] = useState("");
  const [formAreaId, setFormAreaId] = useState("");
  const [editName, setEditName] = useState("");
  const [editSerialNumber, setEditSerialNumber] = useState("");
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const nodesRes = await api.get("/nodes?per_page=100");
      const areasRes = await api.get("/irrigation-areas?per_page=100");

      setNodes(nodesRes.data.data || nodesRes.data);
      setAreas(areasRes.data.data || areasRes.data);
    } catch (err: any) {
      setError(getErrorMessage(err, "Error loading nodes"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAreaId) return;

    try {
      setLoading(true);
      setError(null);

      const latitude = parseCoordinateInput(formLat, "Latitud", -90, 90);
      const longitude = parseCoordinateInput(formLng, "Longitud", -180, 180);

      const res = await api.post("/nodes", {
        irrigation_area_id: parseInt(formAreaId),
        name: formName.trim() || null,
        serial_number: formSerialNumber.trim() || null,
        latitude,
        longitude,
        is_active: true,
      });
      showToast("Nodo creado. La telemetría se autentica con el gateway del predio.", "success");
      setShowCreateForm(false);
      setFormName("");
      setFormSerialNumber("");
      setFormLat("");
      setFormLng("");
      setFormAreaId("");
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

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Seguro que deseas eliminar este nodo?")) return;
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

  const getAreaName = (id: number) => {
    const area = areas.find(a => a.id === id);
    return area ? area.name : "Desconocida";
  };

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-title)] mb-2">Gestión de Nodos</h1>
          <p className="text-[var(--text-subtle)]">Administra los sensores IoT del sistema</p>
        </div>
        <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Nodo
        </PillButton>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-[var(--status-danger)]/25 bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger)]">
          {error}
        </div>
      )}

      {/* Table */}
      <BentoCard variant="light" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-strong)]">
                <th scope="col" className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Nombre</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Serie</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">API Key</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Área Vinculada</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">GPS</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Estado</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node, i) => (
                <tr key={node.id} className={i % 2 === 0 ? "bg-[var(--bg-base)]/30" : ""}>
                  <td className="py-4 px-4">
                    <span className="font-medium text-[var(--text-main)]">
                      {node.name || `Nodo #${node.id}`}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-[var(--text-muted)] font-mono">
                    {node.serial_number || '-'}
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-sm text-[var(--text-muted)]">
                      Se muestra al crear
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-[var(--text-main)]">
                    {getAreaName(node.irrigation_area_id)}
                  </td>
                  <td className="py-4 px-4 text-sm text-[var(--text-subtle)]">
                    {node.latitude !== null && node.longitude !== null
                      ? `${node.latitude}, ${node.longitude}`
                      : 'No configurado'
                    }
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      node.is_active
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20'
                        : 'bg-[var(--status-danger-bg)] text-[var(--status-danger)] border border-[var(--status-danger)]/30'
                    }`}>
                      {node.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(node)}
                        className="p-2 rounded-full hover:bg-[var(--hover-overlay)] transition-colors"
                        title="Editar nodo"
                      >
                        <Pencil className="w-4 h-4 text-[var(--text-main)]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(node.id)}
                        className="p-2 rounded-full hover:bg-[var(--status-danger-bg)] transition-colors"
                        title="Eliminar nodo"
                      >
                        <Trash2 className="w-4 h-4 text-[var(--status-danger)]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {nodes.length === 0 && !loading && (
            <div className="py-8 px-4">
              <EmptyState
                icon={Radio}
                title="Sin nodos IoT registrados"
                description="Registra tu primer sensor para comenzar a recopilar datos de riego."
                action={{
                  label: "Crear primer nodo",
                  onClick: () => setShowCreateForm(true),
                }}
              />
            </div>
          )}
        </div>
      </BentoCard>

      {/* Create form */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-[var(--surface-page)]/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-serif text-[var(--text-title)] mb-6">Nuevo Nodo IoT</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-2">Área de Riego (Obligatorio)</label>
                <select
                  required
                  value={formAreaId}
                  onChange={(e) => setFormAreaId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                >
                  <option value="">Seleccione un área</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-2">Nombre del Nodo</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Sensor Nogal-01"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-2">Número de Serie</label>
                <input
                  type="text"
                  value={formSerialNumber}
                  onChange={(e) => setFormSerialNumber(e.target.value)}
                  placeholder="SN-2026-001"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[var(--text-subtle)] mb-2">Latitud GPS</label>
                  <input
                    type="number"
                    step="any"
                    value={formLat}
                    onChange={(e) => setFormLat(e.target.value)}
                    placeholder="28.6329"
                    className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-subtle)] mb-2">Longitud GPS</label>
                  <input
                    type="number"
                    step="any"
                    value={formLng}
                    onChange={(e) => setFormLng(e.target.value)}
                    placeholder="-106.0691"
                    className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
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
          </BentoCard>
        </div>
      )}

      {/* Edit form */}
      {showEditForm && editingNode && (
        <div className="fixed inset-0 bg-[var(--surface-page)]/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-serif text-[var(--text-title)] mb-6">Editar Nodo IoT</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-2">Área de Riego</label>
                <input
                  type="text"
                  value={getAreaName(editingNode.irrigation_area_id)}
                  readOnly
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-card-primary)] border border-[var(--border-strong)] text-[var(--text-subtle)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-2">Nombre del Nodo</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ej: Sensor Nogal-01"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-2">Número de Serie</label>
                <input
                  type="text"
                  value={editSerialNumber}
                  onChange={(e) => setEditSerialNumber(e.target.value)}
                  placeholder="SN-2026-001"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[var(--text-subtle)] mb-2">Latitud GPS</label>
                  <input
                    type="number"
                    step="any"
                    value={editLat}
                    onChange={(e) => setEditLat(e.target.value)}
                    placeholder="28.6329"
                    className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-subtle)] mb-2">Longitud GPS</label>
                  <input
                    type="number"
                    step="any"
                    value={editLng}
                    onChange={(e) => setEditLng(e.target.value)}
                    placeholder="-106.0691"
                    className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
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
                  Nodo activo
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
          </BentoCard>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
