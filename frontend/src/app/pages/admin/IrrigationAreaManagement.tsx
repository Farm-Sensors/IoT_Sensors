import { Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { BentoCard } from "../../components/BentoCard";
import { EmptyState } from "../../components/EmptyState";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { useToast } from "../../components/Toast";
import { api } from "../../services/api";

type IrrigationArea = {
  id: number;
  property_id: number;
  crop_type_id: number;
  name: string;
  area_size: number | null;
  crop_type?: {
    id: number;
    name: string;
  };
};

type CropType = {
  id: number;
  name: string;
};

export function IrrigationAreaManagement() {
  const { predioId } = useParams<{ predioId: string }>();
  const { showToast } = useToast();

  const [areas, setAreas] = useState<IrrigationArea[]>([]);
  const [cropTypes, setCropTypes] = useState<CropType[]>([]);
  const [propertyName, setPropertyName] = useState("Cargando...");
  const [clientId, setClientId] = useState<number | null>(null);
  const [clientName, setClientName] = useState("...");

  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingArea, setEditingArea] = useState<IrrigationArea | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    crop_type_id: "",
    area_size: "",
  });

  const [editFormData, setEditFormData] = useState({
    name: "",
    crop_type_id: "",
    area_size: "",
  });

  const fetchData = async () => {
    if (!predioId) return;
    try {
      setLoading(true);
      // Fetch property to get client info and name
      const propRes = await api.get(`/properties/${predioId}`);
      setPropertyName(propRes.data.name);
      setClientId(propRes.data.client_id);

      if (propRes.data.client_id) {
         const clientRes = await api.get(`/clients/${propRes.data.client_id}`);
         setClientName(clientRes.data.company_name);
      }

      // Fetch areas and crop types
      const [areasRes, cropsRes] = await Promise.all([
        api.get(`/irrigation-areas?property_id=${predioId}&per_page=100`),
        api.get("/crop-types?per_page=100")
      ]);
      setAreas(areasRes.data.data || []);
      setCropTypes(cropsRes.data.data || []);
    } catch (err) {
      console.error(err);
      setPropertyName("Desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [predioId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.crop_type_id) {
      showToast("Por favor selecciona un tipo de cultivo", "error");
      return;
    }
    try {
      await api.post("/irrigation-areas", {
        property_id: Number(predioId),
        crop_type_id: Number(formData.crop_type_id),
        name: formData.name,
        area_size: formData.area_size ? Number(formData.area_size) : null,
      });
      setShowCreateForm(false);
      setFormData({ name: "", crop_type_id: "", area_size: "" });
      fetchData();
      showToast("Área creada", "success");
    } catch (err: any) {
      showToast("Error al crear área: " + (err.response?.data?.detail || err.message), "error");
    }
  };

  const openEditForm = (area: IrrigationArea) => {
    setEditingArea(area);
    setEditFormData({
      name: area.name || "",
      crop_type_id: String(area.crop_type_id || ""),
      area_size: area.area_size != null ? String(area.area_size) : "",
    });
    setShowEditForm(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArea) return;
    if (!editFormData.crop_type_id) {
      showToast("Por favor selecciona un tipo de cultivo", "error");
      return;
    }

    try {
      await api.put(`/irrigation-areas/${editingArea.id}`, {
        name: editFormData.name,
        crop_type_id: Number(editFormData.crop_type_id),
        area_size: editFormData.area_size ? Number(editFormData.area_size) : null,
      });
      setShowEditForm(false);
      setEditingArea(null);
      fetchData();
      showToast("Área actualizada", "success");
    } catch (err: any) {
      showToast("Error al actualizar área: " + (err.response?.data?.detail || err.message), "error");
    }
  };

  const handleDelete = async (areaId: number) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta área de riego?")) return;
    try {
      await api.delete(`/irrigation-areas/${areaId}`);
      fetchData();
      showToast("Área eliminada", "success");
    } catch (err: any) {
      showToast("Error al eliminar área: " + (err.response?.data?.detail || err.message), "error");
    }
  };

  return (
    <PageTransition>
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-[var(--text-subtle)] mb-2 flex-wrap">
          <Link to="/admin/clientes" className="hover:text-[var(--accent-primary)] transition-colors">Clientes</Link>
          <span>/</span>
          {clientId ? (
            <Link to={`/admin/clientes/${clientId}/predios`} className="hover:text-[var(--accent-primary)] transition-colors">
              {clientName}
            </Link>
          ) : (
             <span>{clientName}</span>
          )}
          <span>/</span>
          <span className="text-[var(--text-main)]">{propertyName}</span>
          <span>/</span>
          <span>Áreas de Riego</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-title)]">Áreas de Riego</h1>
          <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Área
          </PillButton>
        </div>
      </div>

      <div className="hidden md:block">
        <BentoCard variant="light">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-strong)]">
                <th scope="col" className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Nombre</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Cultivo</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Tamaño (Ha)</th>
                <th scope="col" className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="py-6 text-center text-[var(--text-subtle)]">Cargando...</td></tr>
              ) : areas.map((area) => (
                <tr key={area.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--hover-overlay)] transition-colors">
                  <td className="py-3 px-4 text-[var(--text-main)]">{area.name}</td>
                  <td className="py-3 px-4 text-[var(--text-subtle)]">
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-[var(--surface-card-secondary)] text-[var(--text-main)] text-xs border border-[var(--border-subtle)]">
                       {area.crop_type?.name || "No asignado"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[var(--text-subtle)]">{area.area_size ? `${area.area_size} Ha` : "-"}</td>
                  <td className="py-3 px-4 flex justify-end gap-2">
                    <PillButton variant="secondary" className="px-3 py-1 text-xs" onClick={() => openEditForm(area)}>
                      Editar <Pencil className="w-3 h-3 ml-1" />
                    </PillButton>
                    <PillButton
                      variant="outline"
                      className="px-3 py-1 text-xs border-[var(--status-danger)]/40 text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)]"
                      onClick={() => handleDelete(area.id)}
                    >
                      Borrar <Trash2 className="w-3 h-3 ml-1" />
                    </PillButton>
                  </td>
                </tr>
              ))}
              {!loading && areas.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 px-4">
                    <EmptyState
                      icon={Pencil}
                      title="Sin áreas de riego"
                      description="Crea la primera área y asígnale un cultivo para comenzar a recibir lecturas."
                      action={{
                        label: "Crear primera área",
                        onClick: () => setShowCreateForm(true),
                      }}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </BentoCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:hidden">
        {loading && <div className="text-center py-4 text-[var(--text-subtle)]">Cargando...</div>}
        {!loading && areas.map((area) => (
          <BentoCard key={area.id} variant="light" className="p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-[var(--text-main)] font-medium">{area.name}</h3>
            </div>
            <div className="flex items-center gap-2 mt-2">
               <span className="px-2 py-1 bg-[var(--surface-card-secondary)] border border-[var(--border-subtle)] text-[var(--text-main)] text-xs rounded-full">{area.crop_type?.name || "Sin Cultivo"}</span>
               {area.area_size && <span className="text-sm text-[var(--text-subtle)]">{area.area_size} Ha</span>}
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <PillButton variant="secondary" className="w-full justify-center" onClick={() => openEditForm(area)}>
                Editar <Pencil className="w-4 h-4 ml-1" />
              </PillButton>
              <PillButton
                variant="outline"
                className="w-full justify-center border-[var(--status-danger)]/40 text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)]"
                onClick={() => handleDelete(area.id)}
              >
                Borrar Área <Trash2 className="w-4 h-4 ml-1" />
              </PillButton>
            </div>
          </BentoCard>
        ))}
        {!loading && areas.length === 0 && (
          <EmptyState
            icon={Pencil}
            title="Sin áreas de riego"
            description="Crea la primera área y asígnale un cultivo para comenzar a recibir lecturas."
            action={{
              label: "Crear primera área",
              onClick: () => setShowCreateForm(true),
            }}
          />
        )}
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-[var(--surface-page)]/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-serif text-[var(--text-title)]">Nueva Área de Riego</h2>
              <button onClick={() => setShowCreateForm(false)} type="button" aria-label="Cerrar" className="rounded-full p-1 text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] transition-colors"><XCircle className="w-6 h-6" /></button>
            </div>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div>
                <label htmlFor="area-create-name" className="block text-sm text-[var(--text-subtle)] mb-1">Nombre del Área</label>
                <input id="area-create-name" required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" />
              </div>
              <div>
                <label htmlFor="area-create-crop" className="block text-sm text-[var(--text-subtle)] mb-1">Tipo de Cultivo</label>
                <select id="area-create-crop" required value={formData.crop_type_id} onChange={e => setFormData({ ...formData, crop_type_id: e.target.value })} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]">
                  <option value="">Selecciona un cultivo</option>
                  {cropTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="area-create-size" className="block text-sm text-[var(--text-subtle)] mb-1">Tamaño (Hectáreas) - Opcional</label>
                <input id="area-create-size" type="number" step="0.01" value={formData.area_size} onChange={e => setFormData({ ...formData, area_size: e.target.value })} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" />
              </div>
              <div className="flex gap-3 pt-4">
                <PillButton variant="outline" className="flex-1 justify-center" onClick={() => setShowCreateForm(false)} type="button">Cancelar</PillButton>
                <PillButton variant="primary" className="flex-1 justify-center" type="submit">Guardar</PillButton>
              </div>
            </form>
          </BentoCard>
        </div>
      )}

      {showEditForm && editingArea && (
        <div className="fixed inset-0 bg-[var(--surface-page)]/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-serif text-[var(--text-title)]">Editar Área de Riego</h2>
              <button
                onClick={() => {
                  setShowEditForm(false);
                  setEditingArea(null);
                }}
                type="button"
                aria-label="Cerrar"
                className="rounded-full p-1 text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleUpdate}>
              <div>
                <label htmlFor="area-edit-name" className="block text-sm text-[var(--text-subtle)] mb-1">Nombre del Área</label>
                <input
                  id="area-edit-name"
                  required
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
              </div>
              <div>
                <label htmlFor="area-edit-crop" className="block text-sm text-[var(--text-subtle)] mb-1">Tipo de Cultivo</label>
                <select
                  id="area-edit-crop"
                  required
                  value={editFormData.crop_type_id}
                  onChange={(e) => setEditFormData({ ...editFormData, crop_type_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                >
                  <option value="">Selecciona un cultivo</option>
                  {cropTypes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="area-edit-size" className="block text-sm text-[var(--text-subtle)] mb-1">Tamaño (Hectáreas) - Opcional</label>
                <input
                  id="area-edit-size"
                  type="number"
                  step="0.01"
                  value={editFormData.area_size}
                  onChange={(e) => setEditFormData({ ...editFormData, area_size: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <PillButton
                  variant="outline"
                  className="flex-1 justify-center"
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingArea(null);
                  }}
                  type="button"
                >
                  Cancelar
                </PillButton>
                <PillButton variant="primary" className="flex-1 justify-center" type="submit">
                  Guardar Cambios
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
