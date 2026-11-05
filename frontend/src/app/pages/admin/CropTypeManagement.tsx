import { Edit, Leaf, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { SkeletonCard } from "../../components/SkeletonCard";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FormDialog } from "../../components/FormDialog";
import { Field } from "../../components/Field";
import { useEffect, useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { CropPhoto } from "../../components/CropPhoto";
import { CropPhotoPicker, type ChosenPhoto } from "../../components/CropPhotoPicker";
import { listBox } from "./directory/Health";
import { api } from "../../services/api";

interface CropType {
  id: number;
  name: string;
  description: string;
  photo_url?: string | null;
  photo_credit?: string | null;
  photo_page?: string | null;
}

export function CropTypeManagement() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [cropTypes, setCropTypes] = useState<CropType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Cuántas áreas usan cada cultivo (el sistema no deja borrar uno en uso).
  const [usage, setUsage] = useState<Record<number, number> | null>(null);
  const [photo, setPhoto] = useState<ChosenPhoto | null>(null);
  const [editPhoto, setEditPhoto] = useState<ChosenPhoto | null>(null);

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
      try {
        const areas = await api.get<{ data: { crop_type_id: number }[] }>("/irrigation-areas?per_page=100");
        const counts: Record<number, number> = {};
        (areas.data.data ?? []).forEach((a) => { counts[a.crop_type_id] = (counts[a.crop_type_id] ?? 0) + 1; });
        setUsage(counts);
      } catch {
        setUsage(null);
      }
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
        photo_url: photo?.url ?? null,
        photo_credit: photo?.credit ?? null,
        photo_page: photo?.page ?? null,
      });
      setShowCreateForm(false);
      setName("");
      setDescription("");
      setPhoto(null);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error creating crop type");
      setLoading(false);
    }
  };

  const openCreate = () => { setPhoto(null); setShowCreateForm(true); };

  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string; used: number } | null>(null);
  const handleDelete = async (id: number) => {
    try {
      setLoading(true);
      await api.delete(`/crop-types/${id}`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.status === 409 ? "No se puede eliminar: hay áreas de riego que usan este cultivo. Cámbialas de cultivo primero." : err.response?.data?.detail || "No se pudo eliminar el cultivo.");
      setLoading(false);
    }
  };

  const openEdit = (crop: CropType) => {
    setEditingCropId(crop.id);
    setEditName(crop.name || "");
    setEditDescription(crop.description || "");
    setEditPhoto(crop.photo_url ? { url: crop.photo_url, credit: crop.photo_credit ?? "", page: crop.photo_page ?? "" } : null);
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
        // Se manda siempre: null quita la foto y su atribución.
        photo_url: editPhoto?.url ?? null,
        photo_credit: editPhoto?.credit ?? null,
        photo_page: editPhoto?.page ?? null,
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
          title="Catálogo de cultivos"
          action={
            <PillButton variant="primary" onClick={openCreate}>
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

      {cropTypes.length === 0 && !loading ? (
        <EmptyState icon={Leaf} title="Sin tipos de cultivo" description="Agrega cultivos al catálogo para asignarlos en áreas de riego." action={{ label: "Crear primer cultivo", onClick: openCreate }} />
      ) : (
        <ul className={listBox}>
          {cropTypes.map((crop) => {
            const used = usage ? usage[crop.id] ?? 0 : null;
            return (
              <li key={crop.id} className="flex items-center gap-4 px-4 py-3">
                <CropPhoto name={crop.name} url={crop.photo_url} credit={crop.photo_credit} size={64} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold">{crop.name}</h2>
                  <p className="truncate text-sm text-[var(--text-muted)]">
                    {used === null ? crop.description : used === 0 ? "Sin áreas" : `${used} ${used === 1 ? "área lo usa" : "áreas lo usan"}`}
                    {crop.description && used !== null ? ` · ${crop.description}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => openEdit(crop)} aria-label={`Editar el cultivo ${crop.name}`} title="Editar cultivo" className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius)] hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><Edit aria-hidden="true" className="h-4 w-4 text-[var(--text-subtle)]" /></button>
                  <button type="button" onClick={() => setPendingDelete({ id: crop.id, name: crop.name, used: used ?? 0 })} aria-label={`Eliminar el cultivo ${crop.name}`} title={used ? "En uso: no se puede eliminar" : "Eliminar cultivo"} className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius)] hover:bg-[var(--status-danger-bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><Trash2 aria-hidden="true" className="h-4 w-4 text-[var(--status-danger-text)]" /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {cropTypes.some((c) => c.photo_url) && (
        <details className="mt-4 text-xs text-[var(--text-muted)]">
          <summary className="inline-flex min-h-[44px] cursor-pointer items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Fotos de Wikimedia Commons · ver créditos</summary>
          <ul className="space-y-1 pb-2">
            {cropTypes.filter((c) => c.photo_url).map((c) => (
              <li key={c.id}><b className="font-medium text-[var(--text-body)]">{c.name}:</b> {c.photo_credit}{c.photo_page ? <> · <a className="underline underline-offset-2" href={c.photo_page} target="_blank" rel="noreferrer">ver archivo</a></> : null}</li>
            ))}
          </ul>
        </details>
      )}

      {showCreateForm && (<FormDialog open title="Nuevo Tipo de Cultivo" onClose={() => setShowCreateForm(false)}>
            <form onSubmit={handleCreate} className="space-y-4">
              <Field label="Nombre del Cultivo"><input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Nogal"
                  className="w-full px-4 py-2.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                /></Field>

              <Field label="Descripción"><textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Nogal pecanero"
                  className="w-full px-4 py-2.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] resize-none"
                /></Field>

              <CropPhotoPicker cropName={name} value={photo} onChange={setPhoto} />

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
                  className="w-full px-4 py-2.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                /></Field>

              <Field label="Descripción"><textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] resize-none"
                /></Field>

              <CropPhotoPicker cropName={editName} value={editPhoto} onChange={setEditPhoto} />

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
        title={`¿Eliminar el cultivo ${pendingDelete?.name ?? ""}?`}
        description={pendingDelete && pendingDelete.used > 0 ? `${pendingDelete.used} ${pendingDelete.used === 1 ? "área de riego usa" : "áreas de riego usan"} este cultivo, así que el sistema no permitirá eliminarlo mientras las tengan asignadas.` : "Esta acción no se puede deshacer."}
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
