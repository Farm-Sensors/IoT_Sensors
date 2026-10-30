import { Edit, Leaf, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { SkeletonCard } from "../../components/SkeletonCard";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FormDialog } from "../../components/FormDialog";
import { Field } from "../../components/Field";
import { useEffect, useState } from "react";
import { BentoCard } from "../../components/BentoCard";
import { EmptyState } from "../../components/EmptyState";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { cropIcons } from "../../components/icons/CropIcons";
import { api } from "../../services/api";

interface CropType {
  id: number;
  name: string;
  description: string;
}

export function CropTypeManagement() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [cropTypes, setCropTypes] = useState<CropType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingCropId, setEditingCropId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/crop-types");
      setCropTypes(res.data.data || res.data); // Support both formats
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error loading crop types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);
      await api.post("/crop-types", {
        name,
        description,
      });
      setShowCreateForm(false);
      setName("");
      setDescription("");
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error creating crop type");
      setLoading(false);
    }
  };

  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);
  const handleDelete = async (id: number) => {
    try {
      setLoading(true);
      await api.delete(`/crop-types/${id}`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error deleting crop type");
      setLoading(false);
    }
  };

  const openEdit = (crop: CropType) => {
    setEditingCropId(crop.id);
    setEditName(crop.name || "");
    setEditDescription(crop.description || "");
    setShowEditForm(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCropId || !editName.trim()) return;

    try {
      setLoading(true);
      await api.put(`/crop-types/${editingCropId}`, {
        name: editName,
        description: editDescription,
      });
      setShowEditForm(false);
      setEditingCropId(null);
      setEditName("");
      setEditDescription("");
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error updating crop type");
      setLoading(false);
    }
  };

  if (loading && cropTypes.length === 0) {
    return (
      <PageTransition>
        <div className="min-h-screen p-4 md:p-6 lg:p-8"><SkeletonCard lines={4} /></div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <PageHeader
          title="Catálogo de Cultivos"
          subtitle="Gestiona los tipos de cultivo disponibles"
          action={
            <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
              <Plus aria-hidden="true" className="w-4 h-4 mr-2" />
              Nuevo Cultivo
            </PillButton>
          }
        />
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-2xl border border-[var(--status-danger)]/25 bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger-text)]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cropTypes.map((crop) => {
          const rawName = crop.name.toLowerCase();
          const CropIcon = cropIcons[rawName] || Leaf;

          return (
            <BentoCard key={crop.id} variant="light">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-[24px] bg-[var(--surface-card-secondary)] border border-[var(--border-subtle)]">
                    <CropIcon aria-hidden="true" className="w-6 h-6 text-[var(--accent-primary)]" />
                  </div>
                  <div>
                    <h2 className="font-medium text-[var(--text-main)]">{crop.name}</h2>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(crop)}
                    aria-label={`Editar el cultivo ${crop.name}`}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-[var(--hover-overlay)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <Edit aria-hidden="true" className="w-4 h-4 text-[var(--text-subtle)]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete({ id: crop.id, name: crop.name })}
                    aria-label={`Eliminar el cultivo ${crop.name}`}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-[var(--status-danger-bg)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <Trash2 aria-hidden="true" className="w-4 h-4 text-[var(--status-danger)]" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-[var(--text-subtle)]">{crop.description || "Sin descripción"}</p>
            </BentoCard>
          );
        })}
        {cropTypes.length === 0 && !loading && (
          <div className="md:col-span-2 lg:col-span-3">
            <EmptyState
              icon={Leaf}
              title="Sin tipos de cultivo"
              description="Agrega cultivos al catálogo para asignarlos en áreas de riego."
              action={{
                label: "Crear primer cultivo",
                onClick: () => setShowCreateForm(true),
              }}
            />
          </div>
        )}
      </div>

      {showCreateForm && (<FormDialog open title="Nuevo Tipo de Cultivo" onClose={() => setShowCreateForm(false)}>
            <form onSubmit={handleCreate} className="space-y-4">
              <Field label="Nombre del Cultivo"><input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Nogal"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                /></Field>

              <Field label="Descripción"><textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Nogal pecanero"
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] resize-none"
                /></Field>

              <div className="flex gap-3 pt-4">
                <PillButton variant="secondary" type="button" className="flex-1" onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </PillButton>
                <PillButton variant="primary" type="submit" className="flex-1" disabled={loading}>
                  {loading ? 'Creando...' : 'Crear Cultivo'}
                </PillButton>
              </div>
            </form>
          </FormDialog>)}

      {showEditForm && (<FormDialog open title="Editar Tipo de Cultivo" onClose={() => {
                  setShowEditForm(false);
                  setEditingCropId(null);
                }}>
            <form onSubmit={handleUpdate} className="space-y-4">
              <Field label="Nombre del Cultivo"><input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                /></Field>

              <Field label="Descripción"><textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] resize-none"
                /></Field>

              <div className="flex gap-3 pt-4">
                <PillButton
                  variant="secondary"
                  type="button"
                  className="flex-1"
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingCropId(null);
                  }}
                >
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
        title={`¿Eliminar el tipo de cultivo ${pendingDelete?.name ?? ""}?`}
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
