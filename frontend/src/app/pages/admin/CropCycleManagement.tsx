import { Calendar, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { StatusBadge } from "../../components/StatusBadge";
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
import { api } from "../../services/api";
import { getErrorMessage } from "../../utils/errors";

interface IrrigationArea {
  id: number;
  name: string;
}

interface CropCycle {
  id: number;
  irrigation_area_id: number;
  start_date: string;
  end_date: string | null;
}

export function CropCycleManagement() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [areas, setAreas] = useState<IrrigationArea[]>([]);
  const [cycles, setCycles] = useState<CropCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formAreaId, setFormAreaId] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch both areas and cycles
      const [areasRes, cyclesRes] = await Promise.all([
        api.get("/irrigation-areas"),
        api.get("/crop-cycles")
      ]);
      setAreas(areasRes.data.data || areasRes.data);
      setCycles(cyclesRes.data.data || cyclesRes.data);
    } catch (err: any) {
      setError(getErrorMessage(err, "Error loading data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAreaId || !formStartDate) return;

    try {
      setLoading(true);
      await api.post("/crop-cycles", {
        irrigation_area_id: parseInt(formAreaId),
        start_date: formStartDate,
        end_date: formEndDate ? formEndDate : null,
      });
      setShowCreateForm(false);
      setFormAreaId("");
      setFormStartDate("");
      setFormEndDate("");
      fetchData();
    } catch (err: any) {
      setError(getErrorMessage(err, "Error creating crop cycle"));
      setLoading(false);
    }
  };

  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);
  const handleDelete = async (id: number) => {
    try {
      setLoading(true);
      await api.delete(`/crop-cycles/${id}`);
      fetchData();
    } catch (err: any) {
      setError(getErrorMessage(err, "Error deleting crop cycle"));
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading && areas.length === 0) {
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
          title="Gestión de Ciclos de Cultivo"
          subtitle="Administra los ciclos de cultivo por área"
          action={
            <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
              <Plus aria-hidden="true" className="w-4 h-4 mr-2" />
              Nuevo Ciclo
            </PillButton>
          }
        />
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-2xl border border-[var(--status-danger)]/25 bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger-text)]">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {areas.map((area) => {
          const areaCycles = cycles.filter(c => c.irrigation_area_id === area.id)
            .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

          if (areaCycles.length === 0) return null;

          return (
            <BentoCard key={area.id} variant="light">
              <h2 className="text-lg font-medium text-[var(--text-main)] mb-4">{area.name}</h2>

              <div className="space-y-3">
                {areaCycles.map((cycle) => {
                  const isActive = !cycle.end_date || new Date(cycle.end_date) > new Date();

                  return (
                    <div
                      key={cycle.id}
                      className={`p-4 rounded-[24px] border flex items-center justify-between ${
                        isActive
                          ? "bg-[var(--status-active-bg)] border-[var(--status-active)]/40"
                          : "bg-[var(--surface-panel)] border-[var(--border-subtle)]"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${isActive ? 'bg-[var(--status-active)] text-[var(--text-inverted)]' : 'bg-[var(--surface-card-secondary)] text-[var(--text-subtle)]'}`}>
                          <Calendar aria-hidden="true" className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[var(--text-main)]">
                              {formatDate(cycle.start_date)} - {cycle.end_date ? formatDate(cycle.end_date) : 'Actual'}
                            </span>
                            {isActive && (
                              <StatusBadge tone="active" icon={CheckCircle2}>Activo</StatusBadge>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPendingDelete({ id: cycle.id, name: `${cycle.start_date} — ${cycle.end_date ?? "sin fecha de fin"}` })}
                        aria-label={`Eliminar el ciclo ${formatDate(cycle.start_date)} - ${cycle.end_date ? formatDate(cycle.end_date) : "Actual"} de ${area.name}`}
                        className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full hover:bg-[var(--status-danger-bg)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                      >
                        <Trash2 aria-hidden="true" className="w-4 h-4 text-[var(--status-danger)]" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </BentoCard>
          );
        })}
        {areas.length === 0 && !loading && (
          <EmptyState
            icon={Calendar}
            title="Sin áreas de riego"
            description="Aún no existen áreas para crear ciclos de cultivo."
          />
        )}
        {areas.length > 0 && areas.every(a => cycles.filter(c => c.irrigation_area_id === a.id).length === 0) && !loading && (
          <EmptyState
            icon={Calendar}
            title="Sin ciclos de cultivo"
            description="Crea el primer ciclo para comenzar el historial de temporadas agrícolas."
            action={{
              label: "Crear primer ciclo",
              onClick: () => setShowCreateForm(true),
            }}
          />
        )}
      </div>

      {showCreateForm && (<FormDialog open title="Nuevo Ciclo de Cultivo" onClose={() => setShowCreateForm(false)}>
            <form onSubmit={handleCreate} className="space-y-4">
              <Field label="Área de Riego"><select
                  required
                  value={formAreaId}
                  onChange={(e) => setFormAreaId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                >
                  <option value="">Seleccionar área</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>{area.name}</option>
                  ))}
                </select></Field>

              <Field label="Fecha de Inicio"><input
                  type="date"
                  required
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                /></Field>

              <Field label="Fecha de Fin (opcional)"><input
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                /></Field>

              <div className="flex gap-3 pt-4">
                <PillButton variant="secondary" type="button" className="flex-1" onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </PillButton>
                <PillButton variant="primary" type="submit" className="flex-1" disabled={loading}>
                  {loading ? 'Guardando...' : 'Guardar Ciclo'}
                </PillButton>
              </div>
            </form>
          </FormDialog>)}
      <ConfirmDialog
        open={pendingDelete !== null}
        variant="danger"
        title={`¿Eliminar el ciclo de cultivo ${pendingDelete?.name ?? ""}?`}
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
