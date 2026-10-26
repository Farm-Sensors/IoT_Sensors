import { ChevronRight, Pencil, Plus, Trash2, Warehouse, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { BentoCard } from "../../components/BentoCard";
import { EmptyState } from "../../components/EmptyState";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { useToast } from "../../components/Toast";
import { api } from "../../services/api";

type Property = {
  id: number;
  client_id: number;
  name: string;
  location: string | null;
};

export function PropertyManagement() {
  const { clientId } = useParams<{ clientId: string }>();
  const { showToast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [clientName, setClientName] = useState("Cargando...");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    location: "",
  });

  const [editFormData, setEditFormData] = useState({
    name: "",
    location: "",
  });

  const fetchData = async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      const [resClient, resProps] = await Promise.all([
        api.get(`/clients/${clientId}`),
        api.get(`/properties?client_id=${clientId}`)
      ]);
      setClientName(resClient.data.company_name);
      setProperties(resProps.data.data || []);
    } catch (err) {
      console.error(err);
      setClientName("Desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/properties", {
        ...formData,
        client_id: Number(clientId)
      });
      setShowCreateForm(false);
      setFormData({ name: "", location: "" });
      fetchData();
      showToast("Predio creado", "success");
    } catch (err: any) {
      showToast("Error al crear el predio: " + (err.response?.data?.detail || err.message), "error");
    }
  };

  const openEditForm = (property: Property) => {
    setEditingProperty(property);
    setEditFormData({
      name: property.name || "",
      location: property.location || "",
    });
    setShowEditForm(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProperty) return;

    try {
      await api.put(`/properties/${editingProperty.id}`, {
        name: editFormData.name,
        location: editFormData.location,
      });
      setShowEditForm(false);
      setEditingProperty(null);
      fetchData();
      showToast("Predio actualizado", "success");
    } catch (err: any) {
      showToast("Error al actualizar el predio: " + (err.response?.data?.detail || err.message), "error");
    }
  };

  const handleDelete = async (propertyId: number) => {
    if (!window.confirm("¿Seguro que deseas eliminar este predio?")) return;
    try {
      await api.delete(`/properties/${propertyId}`);
      fetchData();
      showToast("Predio eliminado", "success");
    } catch (err: any) {
      showToast("Error al eliminar el predio: " + (err.response?.data?.detail || err.message), "error");
    }
  };

  return (
    <PageTransition>
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-[var(--text-subtle)] mb-2">
          <Link to="/admin/clientes" className="hover:text-[var(--accent-primary)] transition-colors">Clientes</Link>
          <span>/</span>
          <span>{clientName}</span>
          <span>/</span>
          <span>Predios</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-title)]">Predios</h1>
          <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Predio
          </PillButton>
        </div>
      </div>

      <div className="hidden md:block">
        <BentoCard variant="light">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-strong)]">
                <th scope="col" className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Nombre</th>
                <th scope="col" className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Ubicación</th>
                <th scope="col" className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="py-6 text-center text-[var(--text-subtle)]">Cargando...</td></tr>
              ) : properties.map((prop) => (
                <tr key={prop.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--hover-overlay)] transition-colors">
                  <td className="py-3 px-4 text-[var(--text-main)]">{prop.name}</td>
                  <td className="py-3 px-4 text-[var(--text-subtle)]">{prop.location || "-"}</td>
                  <td className="py-3 px-4 flex justify-end gap-2">
                    <PillButton variant="secondary" className="px-3 py-1 text-xs" onClick={() => openEditForm(prop)}>
                      Editar <Pencil className="w-3 h-3 ml-1" />
                    </PillButton>
                    <Link to={`/admin/predios/${prop.id}/areas`}>
                      <PillButton variant="outline" className="px-3 py-1 text-xs">Áreas de Riego <ChevronRight className="w-3 h-3 ml-1" /></PillButton>
                    </Link>
                    <PillButton
                      variant="outline"
                      className="px-3 py-1 text-xs border-[var(--status-danger)]/40 text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)]"
                      onClick={() => handleDelete(prop.id)}
                    >
                      Borrar <Trash2 className="w-3 h-3 ml-1" />
                    </PillButton>
                  </td>
                </tr>
              ))}
              {!loading && properties.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 px-4">
                    <EmptyState
                      icon={Warehouse}
                      title="Sin predios registrados"
                      description="Crea el primer predio para organizar áreas de riego por cliente."
                      action={{
                        label: "Crear primer predio",
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
        {!loading && properties.map((prop) => (
          <BentoCard key={prop.id} variant="light" className="p-4">
            <h3 className="text-[var(--text-main)] font-medium mb-1">{prop.name}</h3>
            <p className="text-sm text-[var(--text-subtle)] mb-4">{prop.location || "Sin ubicación"}</p>
            <div className="flex flex-col gap-2">
              <PillButton variant="secondary" className="w-full justify-center" onClick={() => openEditForm(prop)}>
                Editar <Pencil className="w-4 h-4 ml-1" />
              </PillButton>
              <Link to={`/admin/predios/${prop.id}/areas`}>
                <PillButton variant="outline" className="w-full justify-center">Ver Áreas de Riego <ChevronRight className="w-4 h-4 ml-1" /></PillButton>
              </Link>
              <PillButton
                variant="outline"
                className="w-full justify-center border-[var(--status-danger)]/40 text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)]"
                onClick={() => handleDelete(prop.id)}
              >
                Borrar Predio <Trash2 className="w-4 h-4 ml-1" />
              </PillButton>
            </div>
          </BentoCard>
        ))}
        {!loading && properties.length === 0 && (
          <EmptyState
            icon={Warehouse}
            title="Sin predios registrados"
            description="Crea el primer predio para organizar áreas de riego por cliente."
            action={{
              label: "Crear primer predio",
              onClick: () => setShowCreateForm(true),
            }}
          />
        )}
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-[var(--surface-page)]/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-serif text-[var(--text-title)]">Nuevo Predio</h2>
              <button onClick={() => setShowCreateForm(false)} type="button" aria-label="Cerrar" className="rounded-full p-1 text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)] transition-colors"><XCircle className="w-6 h-6" /></button>
            </div>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div>
                <label htmlFor="property-create-name" className="block text-sm text-[var(--text-subtle)] mb-1">Nombre del Predio</label>
                <input id="property-create-name" required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" />
              </div>
              <div>
                <label htmlFor="property-create-location" className="block text-sm text-[var(--text-subtle)] mb-1">Ubicación (Opcional)</label>
                <input id="property-create-location" type="text" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]" />
              </div>
              <div className="flex gap-3 pt-4">
                <PillButton variant="outline" className="flex-1 justify-center" onClick={() => setShowCreateForm(false)} type="button">Cancelar</PillButton>
                <PillButton variant="primary" className="flex-1 justify-center" type="submit">Guardar</PillButton>
              </div>
            </form>
          </BentoCard>
        </div>
      )}

      {showEditForm && editingProperty && (
        <div className="fixed inset-0 bg-[var(--surface-page)]/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-serif text-[var(--text-title)]">Editar Predio</h2>
              <button
                onClick={() => {
                  setShowEditForm(false);
                  setEditingProperty(null);
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
                <label htmlFor="property-edit-name" className="block text-sm text-[var(--text-subtle)] mb-1">Nombre del Predio</label>
                <input
                  id="property-edit-name"
                  required
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
              </div>
              <div>
                <label htmlFor="property-edit-location" className="block text-sm text-[var(--text-subtle)] mb-1">Ubicación (Opcional)</label>
                <input
                  id="property-edit-location"
                  type="text"
                  value={editFormData.location}
                  onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <PillButton
                  variant="outline"
                  className="flex-1 justify-center"
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingProperty(null);
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
