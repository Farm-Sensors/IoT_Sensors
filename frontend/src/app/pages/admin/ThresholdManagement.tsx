import { Edit, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BentoCard } from "../../components/BentoCard";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { useAuth } from "../../context/AuthContext";
import { useOptionalSelection } from "../../context/SelectionContext";
import { useAreaFromQuery } from "../../hooks/useAreaFromQuery";
import { api } from "../../services/api";
import {
  ThresholdCreatePayload,
  ThresholdItem,
  ThresholdParameter,
  ThresholdSeverity,
  createThreshold,
  deleteThreshold,
  listThresholds,
  updateThreshold,
} from "../../services/thresholds";

type ThresholdFormState = {
  irrigation_area_id: string;
  parameter: ThresholdParameter;
  min_value: string;
  max_value: string;
  severity: ThresholdSeverity;
  active: boolean;
};

type IrrigationAreaItem = {
  id: number;
  name: string;
  property_id: number;
};

const parameterOptions: Array<{ value: ThresholdParameter; label: string; unit: string }> = [
  { value: "soil.conductivity", label: "Suelo: Conductividad", unit: "dS/m" },
  { value: "soil.temperature", label: "Suelo: Temperatura", unit: "C" },
  { value: "soil.humidity", label: "Suelo: Humedad", unit: "%" },
  { value: "soil.water_potential", label: "Suelo: Potencial hídrico", unit: "MPa" },
  { value: "irrigation.active", label: "Riego: Activo", unit: "bool" },
  { value: "irrigation.accumulated_liters", label: "Riego: Litros acumulados", unit: "L" },
  { value: "irrigation.flow_per_minute", label: "Riego: Flujo por minuto", unit: "L/min" },
  { value: "environmental.temperature", label: "Ambiental: Temperatura", unit: "C" },
  { value: "environmental.relative_humidity", label: "Ambiental: Humedad relativa", unit: "%" },
  { value: "environmental.wind_speed", label: "Ambiental: Velocidad viento", unit: "km/h" },
  { value: "environmental.solar_radiation", label: "Ambiental: Radiación solar", unit: "W/m²" },
  { value: "environmental.eto", label: "Ambiental: ETO", unit: "mm/día" },
];

const defaultFormState: ThresholdFormState = {
  irrigation_area_id: "",
  parameter: "soil.humidity",
  min_value: "",
  max_value: "",
  severity: "warning",
  active: true,
};

function toNumberOrNull(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ThresholdManagement() {
  const { user } = useAuth();
  const selection = useOptionalSelection();
  useAreaFromQuery();
  const isClientRole = user?.rol === "cliente";
  const selectionLoading = selection?.loading ?? false;
  const selectedClientAreaId = selection?.selectedArea?.id;

  const [thresholds, setThresholds] = useState<ThresholdItem[]>([]);
  const [areas, setAreas] = useState<IrrigationAreaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState<ThresholdItem | null>(null);
  const [form, setForm] = useState<ThresholdFormState>(defaultFormState);

  const [filterAreaId, setFilterAreaId] = useState<string>("");
  const [filterParameter, setFilterParameter] = useState<string>("");
  const [filterActive, setFilterActive] = useState<string>("");

  const areaNameMap = useMemo(() => {
    return new Map(areas.map((area) => [area.id, area.name]));
  }, [areas]);

  const fetchData = async () => {
    if (isClientRole) {
      if (selectionLoading || !selectedClientAreaId) {
        if (!selectionLoading && !selectedClientAreaId) {
          setThresholds([]);
          setLoading(false);
        }
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      const scopedAreaId =
        isClientRole && selectedClientAreaId
          ? selectedClientAreaId
          : filterAreaId
            ? Number(filterAreaId)
            : undefined;

      const [areasRes, thresholdsRes] = await Promise.all([
        api.get("/irrigation-areas?per_page=200"),
        listThresholds({
          page: 1,
          per_page: 200,
          irrigation_area_id: scopedAreaId,
          parameter: filterParameter ? (filterParameter as ThresholdParameter) : undefined,
          active:
            filterActive === ""
              ? undefined
              : filterActive === "true"
                ? true
                : false,
        }),
      ]);

      setAreas((areasRes.data?.data ?? []) as IrrigationAreaItem[]);
      setThresholds(thresholdsRes.data ?? []);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("No fue posible cargar los umbrales");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [
    filterAreaId,
    filterParameter,
    filterActive,
    isClientRole,
    selectedClientAreaId,
    selectionLoading,
  ]);

  useEffect(() => {
    if (!isClientRole || filterAreaId) {
      return;
    }

    if (!selectedClientAreaId) {
      return;
    }

    const areaId = String(selectedClientAreaId);
    setFilterAreaId(areaId);
    setForm((prev) =>
      prev.irrigation_area_id
        ? prev
        : {
            ...prev,
            irrigation_area_id: areaId,
          }
    );
  }, [isClientRole, selectedClientAreaId, filterAreaId]);

  const resetForm = () => {
    const preferredAreaId = filterAreaId || (isClientRole && selectedClientAreaId ? String(selectedClientAreaId) : "");
    setForm({
      ...defaultFormState,
      irrigation_area_id: preferredAreaId,
    });
    setEditingThreshold(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (threshold: ThresholdItem) => {
    setEditingThreshold(threshold);
    setForm({
      irrigation_area_id: String(threshold.irrigation_area_id),
      parameter: threshold.parameter,
      min_value: threshold.min_value != null ? String(threshold.min_value) : "",
      max_value: threshold.max_value != null ? String(threshold.max_value) : "",
      severity: threshold.severity,
      active: threshold.active,
    });
    setShowForm(true);
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const irrigationAreaId = Number(form.irrigation_area_id);
    if (!Number.isFinite(irrigationAreaId) || irrigationAreaId <= 0) {
      setError("Selecciona un area de riego valida");
      return;
    }

    const minValue = toNumberOrNull(form.min_value);
    const maxValue = toNumberOrNull(form.max_value);

    if (minValue === null && maxValue === null) {
      setError("Debes capturar min_value o max_value");
      return;
    }

    if (minValue !== null && maxValue !== null && minValue > maxValue) {
      setError("min_value no puede ser mayor que max_value");
      return;
    }

    const payload: ThresholdCreatePayload = {
      irrigation_area_id: irrigationAreaId,
      parameter: form.parameter,
      min_value: minValue,
      max_value: maxValue,
      severity: form.severity,
      active: form.active,
    };

    try {
      setSaving(true);
      if (editingThreshold) {
        await updateThreshold(editingThreshold.id, payload);
      } else {
        await createThreshold(payload);
      }
      setShowForm(false);
      resetForm();
      await fetchData();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("No fue posible guardar el umbral");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (thresholdId: number) => {
    if (!window.confirm("Seguro que deseas eliminar este umbral?")) return;

    try {
      setLoading(true);
      await deleteThreshold(thresholdId);
      await fetchData();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("No fue posible eliminar el umbral");
      }
      setLoading(false);
    }
  };

  const parameterLabelMap = useMemo(() => {
    return new Map(parameterOptions.map((option) => [option.value, option.label]));
  }, []);

  return (
    <PageTransition>
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-main)] mb-2">Umbrales</h1>
          <p className="text-[var(--text-subtle)]">
            Define a partir de qué valores te avisamos de cada medición.
          </p>
        </div>
        <PillButton variant="primary" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Umbral
        </PillButton>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-[var(--status-danger)]/25 bg-[var(--status-danger-bg)] p-4 text-[var(--status-danger-text)]">{error}</div>
      )}

      <BentoCard variant="light" className="mb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm text-[var(--text-subtle)] flex flex-col gap-1">
            Área de riego
            <select
              value={filterAreaId}
              onChange={(event) => setFilterAreaId(event.target.value)}
              className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-panel)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            >
              <option value="">Todas</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-[var(--text-subtle)] flex flex-col gap-1">
            Parámetro
            <select
              value={filterParameter}
              onChange={(event) => setFilterParameter(event.target.value)}
              className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-panel)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            >
              <option value="">Todos</option>
              {parameterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-[var(--text-subtle)] flex flex-col gap-1">
            Estado
            <select
              value={filterActive}
              onChange={(event) => setFilterActive(event.target.value)}
              className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-panel)] px-3 py-2 text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </label>
        </div>
      </BentoCard>

      <BentoCard variant="light" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-strong)]">
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Área</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Parámetro</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Min</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Max</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Severidad</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Estado</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[var(--text-subtle)]">
                    Cargando umbrales...
                  </td>
                </tr>
              ) : thresholds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[var(--text-subtle)]">
                    No hay umbrales para los filtros actuales.
                  </td>
                </tr>
              ) : (
                thresholds.map((threshold, index) => (
                  <tr key={threshold.id} className={index % 2 === 0 ? "bg-[var(--surface-card-primary)]/50" : ""}>
                    <td className="py-4 px-4 text-[var(--text-main)]">
                      {areaNameMap.get(threshold.irrigation_area_id) ?? `Area #${threshold.irrigation_area_id}`}
                    </td>
                    <td className="py-4 px-4 text-[var(--text-main)]">
                      {parameterLabelMap.get(threshold.parameter) ?? threshold.parameter}
                    </td>
                    <td className="py-4 px-4 text-[var(--text-main)]">
                      {threshold.min_value ?? "-"}
                    </td>
                    <td className="py-4 px-4 text-[var(--text-main)]">
                      {threshold.max_value ?? "-"}
                    </td>
                    <td className="py-4 px-4 text-[var(--text-main)] uppercase">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                          threshold.severity === "critical"
                            ? "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger)]/30"
                            : threshold.severity === "warning"
                              ? "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning)]/30"
                              : "bg-[var(--status-info-bg)] text-[var(--status-info-text)] border-[var(--status-info)]/30"
                        }`}
                      >
                        {threshold.severity}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          threshold.active
                            ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20"
                            : "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger)]/30"
                        }`}
                      >
                        {threshold.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(threshold)}
                          className="p-2 rounded-full hover:bg-[var(--hover-overlay)] transition-colors"
                          title="Editar umbral"
                        >
                          <Edit className="w-4 h-4 text-[var(--text-subtle)]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(threshold.id)}
                          className="p-2 rounded-full hover:bg-[var(--status-danger-bg)] transition-colors"
                          title="Eliminar umbral"
                        >
                          <Trash2 className="w-4 h-4 text-[var(--status-danger-text)]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </BentoCard>

      {showForm && (
        <div className="fixed inset-0 bg-[var(--surface-page)]/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <BentoCard variant="light" className="w-full max-w-lg">
            <h2 className="text-xl font-serif text-[var(--text-title)] mb-6">
              {editingThreshold ? "Editar Umbral" : "Nuevo Umbral"}
            </h2>

            <form onSubmit={submitForm} className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-2">Área de riego</label>
                <select
                  required
                  value={form.irrigation_area_id}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, irrigation_area_id: event.target.value }))
                  }
                  className="w-full px-4 py-2.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                >
                  <option value="">Selecciona un área</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-[var(--text-subtle)] mb-2">Parámetro</label>
                <select
                  required
                  value={form.parameter}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      parameter: event.target.value as ThresholdParameter,
                    }))
                  }
                  className="w-full px-4 py-2.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                >
                  {parameterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[var(--text-subtle)] mb-2">Mínimo</label>
                  <input
                    type="number"
                    step="any"
                    value={form.min_value}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, min_value: event.target.value }))
                    }
                    className="w-full px-4 py-2.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-subtle)] mb-2">Máximo</label>
                  <input
                    type="number"
                    step="any"
                    value={form.max_value}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, max_value: event.target.value }))
                    }
                    className="w-full px-4 py-2.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[var(--text-subtle)] mb-2">Severidad</label>
                  <select
                    value={form.severity}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        severity: event.target.value as ThresholdSeverity,
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div className="flex items-end pb-2">
                  <label className="inline-flex items-center gap-2 text-sm text-[var(--text-subtle)]">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, active: event.target.checked }))
                      }
                      className="h-4 w-4"
                    />
                    Umbral activo
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <PillButton
                  variant="secondary"
                  type="button"
                  className="flex-1"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </PillButton>
                <PillButton
                  variant="primary"
                  type="submit"
                  className="flex-1"
                  disabled={saving}
                >
                  {saving ? "Guardando..." : editingThreshold ? "Actualizar" : "Crear"}
                </PillButton>
              </div>
            </form>
          </BentoCard>
        </div>
      )}

      <div className="mt-6">
        <BentoCard variant="sand">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[var(--radius)] bg-[var(--surface-card-secondary)] border border-[var(--border-subtle)]">
              <SlidersHorizontal className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            <p className="text-sm text-[var(--text-subtle)]">
              Tip: define al menos un rango para humedad de suelo, flujo de agua y ETO para habilitar semaforos completos en dashboard.
            </p>
          </div>
        </BentoCard>
      </div>
    </div>
    </PageTransition>
  );
}
