import { MapPin, Sprout, Warehouse } from "lucide-react";
import { AreaAlertsLink } from "../../../components/AreaAlertsLink";
import { Breadcrumbs } from "../../../components/Breadcrumbs";
import { useEffect } from "react";
import { Navigate, NavLink, Outlet, useParams } from "react-router";
import { useSelection } from "../../../context/SelectionContext";

const TABS = [
  { to: "", label: "Ahora", end: true },
  { to: "historial", label: "Historial", end: false },
  { to: "detalles", label: "Detalles", end: false },
];

/**
 * `/cliente/area/:areaId`: el área tiene dirección propia y tres pestañas (Ahora, Historial, Detalles).
 * Fija la selección (`SelectionContext`) desde la dirección, así las pantallas de Fase 2 que la usan siguen funcionando.
 */
export function AreaLayout() {
  const { areaId } = useParams();
  const { areas, properties, selectedArea, setSelectedArea, setSelectedProperty, loading } = useSelection();
  const area = areas.find((a) => String(a.id) === areaId) ?? null;
  const property = area ? properties.find((p) => p.id === area.property_id) ?? null : null;

  useEffect(() => {
    if (!area || selectedArea?.id === area.id) return;
    if (property) setSelectedProperty(property);
    setSelectedArea(area);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area?.id]);

  if (loading) return null;
  if (!area) return <Navigate to="/cliente" replace />;
  if (selectedArea?.id !== area.id) return null;

  return (
    <div className="mx-auto max-w-[1280px] p-4 md:p-8">
      <Breadcrumbs items={[
        { label: "Mis predios", to: "/cliente", icon: Warehouse },
        ...(property ? [{ label: property.name, to: `/cliente/predio/${property.id}`, icon: MapPin }] : []),
        { label: area.name, icon: Sprout },
      ]} />
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-[22px] font-semibold md:text-2xl">{area.name}</h1>
        <p className="text-sm text-[var(--text-muted)]">
          {[area.crop_type?.name, area.area_size ? `${area.area_size} ha` : null].filter(Boolean).join(" · ")}
        </p>
      </div>

      <AreaAlertsLink areaId={area.id} />

      <nav aria-label="Secciones del área" className="mb-4 mt-2 flex gap-1 overflow-x-auto border-b border-[var(--border)]" style={{ scrollbarWidth: "none" }}>
        {TABS.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `-mb-px flex min-h-[44px] items-center whitespace-nowrap border-b-[3px] px-4 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                isActive ? "border-[var(--accent-primary)] font-semibold text-[var(--text-main)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
