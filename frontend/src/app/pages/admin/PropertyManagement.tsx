import { ChevronRight, Pencil, Plus, Trash2, Warehouse } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { SkeletonCard } from "../../components/SkeletonCard";
import { HierarchyTrail } from "../../components/HierarchyTrail";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FormDialog } from "../../components/FormDialog";
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

  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);
  const handleDelete = async (propertyId: number) => {
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
        <HierarchyTrail
          items={[
            { label: "Clientes", to: "/admin/clientes" },
            { label: clientName },
            { label: "Predios" },
          ]}
        />
        <PageHeader
          title="Predios"
          subtitle={`Predios de ${clientName}`}
          action={
            <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
              <Plus aria-hidden="true" className="w-4 h-4 mr-2" />
              Nuevo Predio
            </PillButton>
          }
        />
      </div>

      <div className="hidden md:block">
        <BentoCard variant="light">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-strong)]">
                <th scope="col" className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-subtle)]">Nombre</th>
                <th scope="col" className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-subtle)]">Ubicación</th>
                <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-[var(--text-subtle)]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="py-6"><SkeletonCard lines={2} showHeader={false} /></td></tr>
              ) : properties.map((prop) => (
                <tr key={prop.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--hover-overlay)] transition-colors">
                  <td className="py-3 px-4 text-[var(--text-main)]">{prop.name}</td>
                  <td className="py-3 px-4 text-[var(--text-subtle)]">{prop.location || "-"}</td>
                  <td className="py-3 px-4 flex justify-end gap-2">
                    <PillButton variant="secondary" className="px-3 py-1 text-xs" onClick={() => openEditForm(prop)}>
                      Editar <Pencil aria-hidden="true" className="w-3 h-3 ml-1" />
                    </PillButton>
                    <Link to={`/admin/predios/${prop.id}/areas`}>
                      <PillButton variant="outline" className="px-3 py-1 text-xs">Áreas de Riego <ChevronRight aria-hidden="true" className="w-3 h-3 ml-1" /></PillButton>
                    </Link>
                    <PillButton
                      variant="outline"
                      className="px-3 py-1 text-xs border-[var(--status-danger)]/40 text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)]"
                      onClick={() => setPendingDelete({ id: prop.id, name: prop.name })}
                    >
                      Borrar <Trash2 aria-hidden="true" className="w-3 h-3 ml-1" />
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
        {loading && <SkeletonCard lines={2} />}
        {!loading && properties.map((prop) => (
          <BentoCard key={prop.id} variant="light" className="p-4">
            <h2 className="text-[var(--text-main)] font-medium mb-1">{prop.name}</h2>
            <p className="text-sm text-[var(--text-subtle)] mb-4">{prop.location || "Sin ubicación"}</p>
            <div className="flex flex-col gap-2">
              <PillButton variant="secondary" className="w-full justify-center" onClick={() => openEditForm(prop)}>
                Editar <Pencil aria-hidden="true" className="w-4 h-4 ml-1" />
              </PillButton>
              <Link to={`/admin/predios/${prop.id}/areas`}>
                <PillButton variant="outline" className="w-full justify-center">Ver Áreas de Riego <ChevronRight aria-hidden="true" className="w-4 h-4 ml-1" /></PillButton>
              </Link>
              <PillButton
                variant="outline"
                className="w-full justify-center border-[var(--status-danger)]/40 text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)]"
                onClick={() => setPendingDelete({ id: prop.id, name: prop.name })}
              >
                Borrar Predio <Trash2 aria-hidden="true" className="w-4 h-4 ml-1" />
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

      {showCreateForm && (<FormDialog open title="Nuevo Predio" onClose={() => setShowCreateForm(false)}>
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
          </FormDialog>)}

      {showEditForm && editingProperty && (<FormDialog open title="Editar Predio" onClose={() => {
                  setShowEditForm(false);
                  setEditingProperty(null);
                }}>
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
          </FormDialog>)}
      <ConfirmDialog
        open={pendingDelete !== null}
        variant="danger"
        title={`¿Eliminar el predio ${pendingDelete?.name ?? ""}?`}
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
