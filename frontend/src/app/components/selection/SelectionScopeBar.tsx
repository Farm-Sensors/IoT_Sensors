import { ChevronDown, MapPinned, Sprout } from "lucide-react";

import { useOptionalSelection } from "../../context/SelectionContext";

interface SelectionScopeBarProps {
  className?: string;
  showSelectors?: boolean;
}

export function SelectionScopeBar({
  className = "",
  showSelectors = true,
}: SelectionScopeBarProps) {
  const selection = useOptionalSelection();

  if (!selection) return null;

  const {
    properties,
    areas,
    selectedProperty,
    selectedArea,
    setSelectedProperty,
    setSelectedArea,
    loading,
    error,
  } = selection;

  const scopedAreas = selectedProperty
    ? areas.filter((area) => area.property_id === selectedProperty.id)
    : areas;

  return (
    <div
      className={`rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-4 py-3 ${className}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--text-subtle)]">
        <span>Contexto activo</span>
        {loading && <span role="status">Cargando…</span>}
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm text-[var(--status-danger-text)]">
          No se pudo cargar el contexto de predio/área.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-card-secondary)] px-3 py-1.5 text-[var(--text-body)]">
          <MapPinned aria-hidden="true" className="h-4 w-4 text-[var(--accent-primary)]" />
          Predio: {selectedProperty?.name ?? "Sin seleccionar"}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-card-secondary)] px-3 py-1.5 text-[var(--text-body)]">
          <Sprout aria-hidden="true" className="h-4 w-4 text-[var(--accent-primary)]" />
          Área: {selectedArea?.name ?? "Sin seleccionar"}
        </span>
      </div>

      {showSelectors && (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <label className="relative">
            <select
              aria-label="Predio"
              value={selectedProperty?.id ?? ""}
              onChange={(event) => {
                const nextProperty = properties.find(
                  (property) => property.id === Number(event.target.value),
                );
                setSelectedProperty(nextProperty || null);
                if (!nextProperty) {
                  setSelectedArea(null);
                  return;
                }
                const firstArea = areas.find(
                  (area) => area.property_id === nextProperty.id,
                );
                setSelectedArea(firstArea || null);
              }}
              className="w-full appearance-none min-h-[44px] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-app)] py-2 pl-3 pr-9 text-sm text-[var(--text-body)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <option value="" disabled>
                Selecciona predio
              </option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
          </label>

          <label className="relative">
            <select
              aria-label="Área de riego"
              value={selectedArea?.id ?? ""}
              onChange={(event) => {
                const nextArea = areas.find(
                  (area) => area.id === Number(event.target.value),
                );
                setSelectedArea(nextArea || null);
                if (!nextArea) return;
                if (!selectedProperty || selectedProperty.id !== nextArea.property_id) {
                  const nextProperty = properties.find(
                    (property) => property.id === nextArea.property_id,
                  );
                  setSelectedProperty(nextProperty || null);
                }
              }}
              className="w-full appearance-none min-h-[44px] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-app)] py-2 pl-3 pr-9 text-sm text-[var(--text-body)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <option value="" disabled>
                Selecciona área
              </option>
              {scopedAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
          </label>
        </div>
      )}
    </div>
  );
}
