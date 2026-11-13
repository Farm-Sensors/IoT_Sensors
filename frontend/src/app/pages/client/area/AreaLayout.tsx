import { Eye, MapPin, Sprout, Users, Warehouse } from "lucide-react";
import { AreaAlertsLink } from "../../../components/AreaAlertsLink";
import { Breadcrumbs } from "../../../components/Breadcrumbs";
import { useEffect } from "react";
import { Link, Navigate, NavLink, Outlet, useParams } from "react-router";
import { useSelection } from "../../../context/SelectionContext";

const TABS = [
  { to: "", label: "Ahora", end: true },
  { to: "historial", label: "Historial", end: false },
  { to: "detalles", label: "Detalles", end: false },
];

/**
 * `/cliente/area/:areaId`: el área tiene dirección propia y tres pestañas (Ahora, Historial, Detalles).
 * Fija la selección (`SelectionContext`) desde la dirección, así las pantallas de Fase 2 que la usan siguen funcionando.
 *
 * Con `supervision` (ruta `/admin/areas/:areaId/ver`) el administrador ve las mismas pestañas que el cliente,
 * dentro de su propio menú, con un aviso de solo lectura y un regreso al panel del área.
 */
export function AreaLayout({ supervision = false }: { supervision?: boolean }) {
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
  if (!area) return <Navigate to={supervision ? "/admin/clientes" : "/cliente"} replace />;
  if (selectedArea?.id !== area.id) return null;

  const crumbs = supervision
    ? [
        { label: "Clientes", to: "/admin/clientes", icon: Users },
        ...(property ? [{ label: property.name, to: `/admin/predios/${property.id}/areas`, icon: MapPin }] : []),
        { label: area.name, to: `/admin/areas/${area.id}`, icon: Sprout },
        { label: "Vista del cliente", icon: Eye },
      ]
    : [
        { label: "Mis predios", to: "/cliente", icon: Warehouse },
        ...(property ? [{ label: property.name, to: `/cliente/predio/${property.id}`, icon: MapPin }] : []),
        { label: area.name, icon: Sprout },
      ];

  return (
    <div className="mx-auto max-w-[1280px] p-4 md:p-8">
      <Breadcrumbs items={crumbs} />
      {supervision && (
        <div role="note" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-2 text-sm">
          <span className="inline-flex items-center gap-2">
            <Eye aria-hidden="true" className="h-4 w-4" />
            Ves esta área como la ve el cliente. Solo lectura.
          </span>
          <Link to={`/admin/areas/${area.id}`} className="inline-flex min-h-[44px] items-center font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
            Volver al panel del área
          </Link>
        </div>
      )}
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-[22px] font-semibold md:text-2xl">{area.name}</h1>
        <p className="text-sm text-[var(--text-muted)]">
          {[area.crop_type?.name, area.area_size ? `${area.area_size} ha` : null].filter(Boolean).join(" · ")}
        </p>
      </div>

      {!supervision && <AreaAlertsLink areaId={area.id} />}

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
