import { Edit, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EmptyState } from "../../components/EmptyState";
import { FormDialog } from "../../components/FormDialog";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { useAuth } from "../../context/AuthContext";
import { useOptionalSelection } from "../../context/SelectionContext";
import { useAlertPlaces } from "../../hooks/useAlertPlaces";
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
import { parameterLabel, parameterUnit, PARAMETER_GROUPS, SEVERITY_META } from "../shared/alertFormat";

type ThresholdFormState = {
  irrigation_area_id: string;
  parameter: ThresholdParameter;
  min_value: string;
  max_value: string;
  severity: ThresholdSeverity;
  active: boolean;
};

const defaultFormState: ThresholdFormState = {
  irrigation_area_id: "",
  parameter: "soil.humidity",
  min_value: "",
  max_value: "",
  severity: "warning",
  active: true,
};

const control =
  "min-h-[44px] w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-panel)] px-3 text-sm text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";
const SEVERITIES: ThresholdSeverity[] = ["critical", "warning", "info"];

function toNumberOrNull(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** «Avisar si baja de 20 % o sube de 30 %»: la regla en palabras, con la unidad de la medición. */
function ruleSentence(item: Pick<ThresholdItem, "parameter" | "min_value" | "max_value">): string {
  const unit = parameterUnit(item.parameter);
  const fmt = (n: number) => `${n.toLocaleString("es-MX", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
  const low = item.min_value !== null ? `baja de ${fmt(item.min_value)}` : null;
  const high = item.max_value !== null ? `sube de ${fmt(item.max_value)}` : null;
  return `Avisar si ${[low, high].filter(Boolean).join(" o ")}`;
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm text-[var(--text-subtle)]">
      {children}
    </label>
  );
}

/**
 * Umbrales (productor y administrador): a partir de qué valores se avisa de cada medición, por área.
 * Se llega por Predio › Área; la lista se agrupa por área y cada regla se lee como una frase.
 */
export function ThresholdManagement() {
  const { user } = useAuth();
  const isAdmin = user?.rol !== "cliente";
  const selection = useOptionalSelection();
  const areas = selection?.areas ?? [];
  const properties = selection?.properties ?? [];
  const { placeOf, clientOf } = useAlertPlaces(isAdmin);
  const [searchParams] = useSearchParams();

  const [thresholds, setThresholds] = useState<ThresholdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState<ThresholdItem | null>(null);
  const [form, setForm] = useState<ThresholdFormState>(defaultFormState);
  const [pendingDelete, setPendingDelete] = useState<ThresholdItem | null>(null);

  const [areaId, setAreaId] = useState<number>(() => Number(searchParams.get("area")) || 0);
  const [propertyId, setPropertyId] = useState<number>(0);
  const [filterParameter, setFilterParameter] = useState("");
  const [filterActive, setFilterActive] = useState("");

  // Con `?area=` (desde Área › Detalles) el predio de esa área se elige solo.
  useEffect(() => {
    if (!areaId || propertyId) return;
    const area = areas.find((a) => a.id === areaId);
    if (area) setPropertyId(area.property_id);
  }, [areaId, propertyId, areas]);

  const propertyAreas = useMemo(() => areas.filter((a) => a.property_id === propertyId), [areas, propertyId]);
  // La API filtra por un área a la vez: para «todo el predio» se pide cada área y se unen.
  const scopeAreaIds: number[] | null = areaId ? [areaId] : propertyId ? propertyAreas.map((a) => a.id) : null;
  const scopeKey = scopeAreaIds ? scopeAreaIds.join(",") : "all";

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const common = {
        page: 1,
        per_page: 200,
        parameter: filterParameter ? (filterParameter as ThresholdParameter) : undefined,
        active: filterActive === "" ? undefined : filterActive === "true",
      };
      if (scopeAreaIds === null) {
        setThresholds((await listThresholds(common)).data ?? []);
      } else if (scopeAreaIds.length === 0) {
        setThresholds([]);
      } else {
        const lists = await Promise.all(scopeAreaIds.map((id) => listThresholds({ ...common, irrigation_area_id: id })));
        setThresholds(lists.flatMap((l) => l.data ?? []));
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "No fue posible cargar los umbrales");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, filterParameter, filterActive]);

  const resetForm = () => {
    setForm({ ...defaultFormState, irrigation_area_id: areaId ? String(areaId) : "" });
    setEditingThreshold(null);
    setFormError(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (threshold: ThresholdItem) => {
    setEditingThreshold(threshold);
    setFormError(null);
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

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const irrigationAreaId = Number(form.irrigation_area_id);
    if (!Number.isFinite(irrigationAreaId) || irrigationAreaId <= 0) {
      setFormError("Elige el área a la que se aplica.");
      return;
    }

    const minValue = toNumberOrNull(form.min_value);
    const maxValue = toNumberOrNull(form.max_value);

    if (minValue === null && maxValue === null) {
      setFormError("Escribe un mínimo, un máximo o los dos.");
      return;
    }

    if (minValue !== null && maxValue !== null && minValue > maxValue) {
      setFormError("El mínimo no puede ser mayor que el máximo.");
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
      closeForm();
      await fetchData();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setFormError(typeof detail === "string" ? detail : "No fue posible guardar el umbral.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      setLoading(true);
      await deleteThreshold(target.id);
      await fetchData();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "No fue posible eliminar el umbral");
      setLoading(false);
    }
  };

  // Lista agrupada por área, en el orden de aparición de las áreas.
  const groups = useMemo(() => {
    const byArea = new Map<number, ThresholdItem[]>();
    for (const item of thresholds) byArea.set(item.irrigation_area_id, [...(byArea.get(item.irrigation_area_id) ?? []), item]);
    return Array.from(byArea.entries());
  }, [thresholds]);

  const formAreas = isAdmin || areas.length > 0 ? areas : [];
  const hasFilters = Boolean(areaId || propertyId || filterParameter || filterActive);
  const clearFilters = () => {
    setAreaId(0);
    setPropertyId(0);
    setFilterParameter("");
    setFilterActive("");
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-[1100px] p-4 md:p-8">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-title)] md:text-3xl">Umbrales</h1>
            <p className="mt-1 max-w-xl text-sm text-[var(--text-subtle)]">
              Define a partir de qué valores te avisamos de cada medición, por área. Cuando una medición los cruza, se crea una alerta.
            </p>
          </div>
          <PillButton variant="primary" onClick={openCreate}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            Nuevo umbral
          </PillButton>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-[var(--radius)] border border-[var(--status-danger-text)]/30 bg-[var(--status-danger-bg)] p-3 text-sm text-[var(--status-danger-text)]">
            {error}
          </div>
        )}

        <div className="mb-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="min-w-[200px] flex-1">
              <span className="sr-only">Predio</span>
              <select
                value={propertyId}
                onChange={(event) => {
                  setPropertyId(Number(event.target.value));
                  setAreaId(0);
                }}
                className={control}
              >
                <option value={0}>Todos los predios</option>
                {properties.map((property) => {
                  const client = clientOf(property.id);
                  return (
                    <option key={property.id} value={property.id}>
                      {client ? `${client} › ${property.name}` : property.name}
                    </option>
                  );
                })}
              </select>
            </label>
            {propertyId > 0 && (
              <label className="min-w-[180px] flex-1">
                <span className="sr-only">Área del predio</span>
                <select value={areaId} onChange={(event) => setAreaId(Number(event.target.value))} className={control}>
                  <option value={0}>Todas las áreas del predio ({propertyAreas.length})</option>
                  {propertyAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="min-w-[180px] flex-1">
              <span className="sr-only">Medición</span>
              <select value={filterParameter} onChange={(event) => setFilterParameter(event.target.value)} className={control}>
                <option value="">Todas las mediciones</option>
                {PARAMETER_GROUPS.map((group) => (
                  <optgroup key={group.group} label={group.group}>
                    {group.items.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div role="group" aria-label="Estado del umbral" className="inline-flex overflow-hidden rounded-[var(--radius)] border border-[var(--border-strong)]">
              {([["", "Todos"], ["true", "Activos"], ["false", "Pausados"]] as Array<[string, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filterActive === value}
                  onClick={() => setFilterActive(value)}
                  className={`min-h-[44px] px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] ${
                    filterActive === value ? "bg-[var(--accent-soft)] font-semibold text-[var(--text-main)]" : "text-[var(--text-muted)] hover:bg-[var(--hover-overlay)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <p role="status" className="py-10 text-center text-sm text-[var(--text-subtle)]">Cargando umbrales…</p>
        ) : thresholds.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
            {hasFilters ? (
              <EmptyState
                icon={SlidersHorizontal}
                title="Ningún umbral coincide con el filtro"
                action={{ label: "Limpiar filtros", onClick: clearFilters }}
              />
            ) : (
              <EmptyState
                icon={SlidersHorizontal}
                title="Aún no hay umbrales"
                description="Crea el primero para que te avisemos cuando la humedad del suelo, el flujo de agua o la E.T.O. salgan de su rango."
                action={{ label: "Crear el primer umbral", onClick: openCreate }}
              />
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(([groupAreaId, items]) => (
              <section key={groupAreaId} aria-labelledby={`umbrales-area-${groupAreaId}`}>
                <h2 id={`umbrales-area-${groupAreaId}`} className="mb-2 text-sm font-semibold text-[var(--text-main)]">
                  {placeOf(groupAreaId).where} <span className="font-normal text-[var(--text-muted)]">· {items.length}</span>
                </h2>
                <ul className="space-y-2">
                  {items.map((threshold) => {
                    const meta = SEVERITY_META[threshold.severity];
                    const Icon = meta.icon;
                    return (
                      <li
                        key={threshold.id}
                        className={`flex items-stretch overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] ${threshold.active ? "" : "opacity-70"}`}
                      >
                        <span aria-hidden="true" className={`w-1 flex-shrink-0 ${meta.bar}`} />
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-3 py-3 md:px-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-semibold text-[var(--text-main)]">{parameterLabel(threshold.parameter) ?? "Medición"}</p>
                            <p className="font-mono-data text-sm text-[var(--text-muted)]">{ruleSentence(threshold)}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${meta.bg} ${meta.text}`}>
                              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                              {meta.label}
                            </span>
                            <span className={`font-semibold ${threshold.active ? "text-[var(--text-main)]" : "text-[var(--text-muted)]"}`}>
                              {threshold.active ? "Activo" : "Pausado"}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center border-l border-[var(--border)]">
                          <button
                            type="button"
                            onClick={() => openEdit(threshold)}
                            aria-label={`Editar el umbral de ${parameterLabel(threshold.parameter) ?? "medición"}`}
                            title="Editar"
                            className="inline-flex h-full min-h-[44px] w-12 items-center justify-center text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
                          >
                            <Edit aria-hidden="true" className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(threshold)}
                            aria-label={`Eliminar el umbral de ${parameterLabel(threshold.parameter) ?? "medición"}`}
                            title="Eliminar"
                            className="inline-flex h-full min-h-[44px] w-12 items-center justify-center border-l border-[var(--border)] text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
                          >
                            <Trash2 aria-hidden="true" className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        {showForm && (
          <FormDialog open title={editingThreshold ? "Editar umbral" : "Nuevo umbral"} onClose={closeForm}>
            <form onSubmit={submitForm} className="space-y-4" noValidate>
              {formError && (
                <p role="alert" className="rounded-[var(--radius)] bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-text)]">{formError}</p>
              )}
              <div>
                <Label htmlFor="umbral-area">Área</Label>
                <select
                  id="umbral-area"
                  value={form.irrigation_area_id}
                  onChange={(event) => setForm((prev) => ({ ...prev, irrigation_area_id: event.target.value }))}
                  className={control}
                >
                  <option value="">Elige un área</option>
                  {formAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {placeOf(area.id).where}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="umbral-medicion">Medición</Label>
                <select
                  id="umbral-medicion"
                  value={form.parameter}
                  onChange={(event) => setForm((prev) => ({ ...prev, parameter: event.target.value as ThresholdParameter }))}
                  className={control}
                >
                  {PARAMETER_GROUPS.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.items.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                          {item.unit ? ` (${item.unit})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {form.parameter === "irrigation.active" && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Esta medición vale 1 con el riego encendido y 0 apagado.</p>
                )}
              </div>

              <fieldset>
                <legend className="mb-1.5 text-sm text-[var(--text-subtle)]">Avisar si la medición…</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="umbral-min">Baja de{parameterUnit(form.parameter) ? ` (${parameterUnit(form.parameter)})` : ""}</Label>
                    <input
                      id="umbral-min"
                      type="number"
                      step="any"
                      value={form.min_value}
                      onChange={(event) => setForm((prev) => ({ ...prev, min_value: event.target.value }))}
                      className={control}
                    />
                  </div>
                  <div>
                    <Label htmlFor="umbral-max">Sube de{parameterUnit(form.parameter) ? ` (${parameterUnit(form.parameter)})` : ""}</Label>
                    <input
                      id="umbral-max"
                      type="number"
                      step="any"
                      value={form.max_value}
                      onChange={(event) => setForm((prev) => ({ ...prev, max_value: event.target.value }))}
                      className={control}
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Déjalo vacío si no hay límite de ese lado.</p>
              </fieldset>

              <div className="grid grid-cols-2 items-end gap-3">
                <div>
                  <Label htmlFor="umbral-gravedad">Gravedad de la alerta</Label>
                  <select
                    id="umbral-gravedad"
                    value={form.severity}
                    onChange={(event) => setForm((prev) => ({ ...prev, severity: event.target.value as ThresholdSeverity }))}
                    className={control}
                  >
                    {SEVERITIES.map((severity) => (
                      <option key={severity} value={severity}>
                        {SEVERITY_META[severity].label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="inline-flex min-h-[44px] items-center gap-2 text-sm text-[var(--text-main)]">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                    className="h-5 w-5"
                  />
                  Umbral activo
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <PillButton variant="secondary" type="button" className="flex-1" onClick={closeForm}>
                  Cancelar
                </PillButton>
                <PillButton variant="primary" type="submit" className="flex-1" disabled={saving}>
                  {saving ? "Guardando…" : editingThreshold ? "Guardar cambios" : "Crear umbral"}
                </PillButton>
              </div>
            </form>
          </FormDialog>
        )}

        <ConfirmDialog
          open={pendingDelete !== null}
          title="¿Eliminar este umbral?"
          description={
            pendingDelete
              ? `Dejaremos de avisarte cuando ${(parameterLabel(pendingDelete.parameter) ?? "la medición").toLowerCase()} cruce ${ruleSentence(pendingDelete).replace("Avisar si ", "")}. Las alertas que ya se crearon se conservan.`
              : undefined
          }
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      </div>
    </PageTransition>
  );
}
