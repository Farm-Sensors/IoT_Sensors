import { Calendar, Plus, Trash2 } from "lucide-react";
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

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Seguro que deseas eliminar este ciclo?")) return;
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
        <div className="flex justify-center items-center min-h-screen p-4 text-[var(--text-subtle)]">
          Cargando datos...
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-title)] mb-2">Gestión de Ciclos de Cultivo</h1>
          <p className="text-[var(--text-subtle)]">Administra los ciclos de cultivo por área</p>
        </div>
        <PillButton variant="primary" onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Ciclo
        </PillButton>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-[var(--status-danger)]/25 bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger)]">
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
              <h3 className="text-lg font-medium text-[var(--text-main)] mb-4">{area.name}</h3>

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
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[var(--text-main)]">
                              {formatDate(cycle.start_date)} - {cycle.end_date ? formatDate(cycle.end_date) : 'Actual'}
                            </span>
                            {isActive && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--status-active-bg)] text-[var(--status-active)] border border-[var(--status-active)]/30">
                                Activo
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(cycle.id)}
                        className="p-2 rounded-full hover:bg-[var(--status-danger-bg)] transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-[var(--status-danger)]" />
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

      {showCreateForm && (
        <div className="fixed inset-0 bg-[var(--surface-page)]/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-md">
            <h2 className="text-xl font-serif text-[var(--text-title)] mb-6">Nuevo Ciclo de Cultivo</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-2">Área de Riego</label>
                <select
                  required
                  value={formAreaId}
                  onChange={(e) => setFormAreaId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                >
                  <option value="">Seleccionar área</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>{area.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-2">Fecha de Inicio</label>
                <input
                  type="date"
                  required
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-2">Fecha de Fin (opcional)</label>
                <input
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <PillButton variant="secondary" type="button" className="flex-1" onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </PillButton>
                <PillButton variant="primary" type="submit" className="flex-1" disabled={loading}>
                  {loading ? 'Guardando...' : 'Guardar Ciclo'}
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
