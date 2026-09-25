import { ChevronRight, Warehouse } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { BentoCard } from "../../components/BentoCard";
import { EmptyState } from "../../components/EmptyState";
import { FreshnessIndicator } from "../../components/FreshnessIndicator";
import { GatewayStatusBadge } from "../../components/GatewayStatusBadge";
import { PageTransition } from "../../components/PageTransition";
import { SkeletonCard } from "../../components/SkeletonCard";
import { cropIcons } from "../../components/icons/CropIcons";
import { IrrigationArea, useSelection } from "../../context/SelectionContext";
import { usePropertyGatewayStatus } from "../../hooks/usePropertyGatewayStatus";
import { api } from "../../services/api";
import { parseBackendTimestamp } from "../../utils/datetime";

function AreaCard({
  area,
  onClick,
  animationDelay = 0,
}: {
  area: IrrigationArea;
  onClick: () => void;
  animationDelay?: number;
}) {
  const gatewayStatus = usePropertyGatewayStatus(area.property_id);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchLatestReading() {
      try {
        const res = await api.get(`/readings/latest?irrigation_area_id=${area.id}`);
        if (mounted && res.data) {
          if (res.data.soil?.humidity !== undefined && res.data.soil.humidity !== null) {
            setHumidity(res.data.soil.humidity);
          }
          setLastUpdate(parseBackendTimestamp(res.data.timestamp));
        }
      } catch (err) {
        console.error("Error fetching latest reading for area", area.id, err);
      }
    }
    fetchLatestReading();
    return () => { mounted = false; };
  }, [area.id]);

  const cropName = area.crop_type?.name?.toLowerCase() || "";
  let CropIcon: any = cropIcons.nogal;
  if (cropName.includes("alfalfa")) CropIcon = cropIcons.alfalfa;
  else if (cropName.includes("manzana")) CropIcon = cropIcons.manzana;
  else if (cropName.includes("maíz") || cropName.includes("maiz")) CropIcon = cropIcons.maiz;
  else if (cropName.includes("chile")) CropIcon = cropIcons.chile;
  else if (cropName.includes("algodón") || cropName.includes("algodon")) CropIcon = cropIcons.algodon;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Ver área ${area.name}`}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="cursor-pointer animate-fade-in-up focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] rounded-[32px]"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <BentoCard
        variant="light"
        className="h-full flex flex-col justify-between hover:-translate-y-1 transition-transform duration-200"
      >
        <div>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-[24px] bg-[var(--card-sand)]">
                <CropIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base text-[var(--text-main)] font-medium">{area.name}</h3>
                <p className="text-sm text-[var(--text-muted)]">{area.area_size || 0} ha</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" />
          </div>

          {/* Crop type badge */}
          {area.crop_type?.name && (
            <span className="inline-block px-3 py-1 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-xs font-medium mb-4">
              {area.crop_type.name}
            </span>
          )}

          {/* Humidity bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[var(--text-muted)]">Humedad actual</span>
              <span className="text-sm font-bold text-[var(--text-main)]">
                {humidity !== null ? `${humidity.toFixed(1)}%` : "N/D"}
              </span>
            </div>
            <div className="h-2 bg-[var(--progress-track)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent-primary)] rounded-full transition-all duration-700"
                style={{ width: humidity !== null ? `${Math.min(100, Math.max(0, humidity))}%` : "0%" }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lastUpdate && <FreshnessIndicator lastUpdate={lastUpdate} />}
          <GatewayStatusBadge status={gatewayStatus?.status} edgeStatus={gatewayStatus?.edge_status} />
        </div>
      </BentoCard>
    </div>
  );
}

export function AreaSelector() {
  const { properties, areas, setSelectedProperty, setSelectedArea, loading, error } = useSelection();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
        <div className="mb-6">
          <div className="h-8 w-64 rounded-full animate-shimmer mb-2" />
          <div className="h-4 w-48 rounded-full animate-shimmer" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-4 md:p-6 lg:p-8 flex items-center justify-center">
        <p className="text-[#DC2626] text-sm">{error}</p>
      </div>
    );
  }

  const hasAreas = properties.some(p => areas.some(a => a.property_id === p.id));

  return (
    <PageTransition>
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-title)] mb-2">Predios y Áreas de Riego</h1>
          <p className="text-[var(--text-subtle)]">Selecciona un área para ver sus datos en tiempo real</p>
        </div>

        {!hasAreas && (
          <EmptyState
            icon={Warehouse}
            title="Sin predios disponibles"
            description="No se encontraron predios asignados a tu cuenta. Contacta al administrador."
          />
        )}

        {properties.map((property) => {
          const propertyAreas = areas.filter((a) => a.property_id === property.id);
          if (propertyAreas.length === 0) return null;

          return (
            <div key={property.id} className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-serif text-[var(--text-title)]">{property.name}</h2>
                {property.location && (
                  <span className="text-sm text-[var(--text-subtle)]">{property.location}</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {propertyAreas.map((area, idx) => (
                  <AreaCard
                    key={area.id}
                    area={area}
                    animationDelay={idx * 80}
                    onClick={() => {
                      setSelectedProperty(property);
                      setSelectedArea(area);
                      navigate("/cliente");
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </PageTransition>
  );
}
