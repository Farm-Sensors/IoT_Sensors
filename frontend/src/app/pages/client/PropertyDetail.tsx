import { CheckCircle2, MapPin, RadioTower, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { BentoCard } from "../../components/BentoCard";
import { EmptyState } from "../../components/EmptyState";
import { FreshnessIndicator } from "../../components/FreshnessIndicator";
import { GatewayStatusBadge } from "../../components/GatewayStatusBadge";
import { usePropertyGatewayStatus } from "../../hooks/usePropertyGatewayStatus";
import { PageHeader } from "../../components/PageHeader";
import { PageTransition } from "../../components/PageTransition";
import { SkeletonCard } from "../../components/SkeletonCard";
import { StatusBadge } from "../../components/StatusBadge";
import { cropIcons } from "../../components/icons/CropIcons";
import { useSelection } from "../../context/SelectionContext";
import { api } from "../../services/api";
import { NodeItem } from "../../types/api";
import { parseBackendTimestamp } from "../../utils/datetime";

function AreaCard({ area }: { area: any }) {
  const [humidity, setHumidity] = useState<number | null>(null);
  const [lastReading, setLastReading] = useState<Date | null>(null);

  useEffect(() => {
    api.get(`/readings?irrigation_area_id=${area.id}&per_page=1`)
      .then(res => {
        const data = res.data?.data || [];
        if (data.length > 0) {
          const reading = data[0];
          setHumidity(reading.soil?.humidity ?? null);
          setLastReading(parseBackendTimestamp(reading.timestamp));
        }
      })
      .catch(err => {
        console.error("Failed to fetch latest reading", err);
      });
  }, [area.id]);

  const rawCropName = area.crop_type?.name?.toLowerCase() || '';
  const IconKey = Object.keys(cropIcons).find(k => k.toLowerCase() === rawCropName);
  const CropIcon = IconKey ? cropIcons[IconKey as keyof typeof cropIcons] : cropIcons["nogal"];

  const displayHumidity = humidity ?? 0;

  return (
    <BentoCard variant="light" className="h-full">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-3 rounded-[24px] bg-[var(--card-sand)]">
          <CropIcon aria-hidden="true" className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg text-[var(--text-title)] font-medium">{area.name}</h3>
          <p className="text-sm text-[var(--text-subtle)]">{area.area_size || 0} ha</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-[var(--text-subtle)]">Humedad</span>
            <span className="font-bold text-[var(--text-body)]">
              {humidity !== null ? humidity.toFixed(1) + '%' : 'Sin datos'}
            </span>
          </div>
          <div aria-hidden="true" className="h-2 bg-[var(--progress-track)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent-primary)] rounded-full transition-all"
              style={{ width: `${displayHumidity}%` }}
            />
          </div>
        </div>

        {lastReading && <FreshnessIndicator lastUpdate={lastReading} />}
      </div>
    </BentoCard>
  );
}

function NodesPanel({ areas }: { areas: any[] }) {
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const areaIdsKey = areas.map((area) => area.id).join(",");

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setNodes([]);

    if (areas.length === 0) {
      setLoading(false);
      return;
    }

    Promise.all(
      areas.map((area) =>
        api
          .get<{ data: NodeItem[] }>("/nodes", {
            params: { irrigation_area_id: area.id },
          })
          .then((res) => res.data?.data ?? [])
          .catch(() => [] as NodeItem[])
      )
    ).then((results) => {
      if (!isMounted) return;
      setNodes(results.flat());
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [areaIdsKey]);

  const areaName = (id: number) =>
    areas.find((a) => a.id === id)?.name ?? `Área ${id}`;

  return (
    <BentoCard variant="light" className="mb-6">
      <h2 className="text-lg text-[var(--text-title)] mb-4">Sensores por Área</h2>
      {loading ? (
        <SkeletonCard lines={2} showHeader={false} />
      ) : nodes.length === 0 ? (
        <EmptyState
          icon={RadioTower}
          title="Sin sensores registrados"
          description="Esta propiedad no tiene nodos IoT vinculados a sus áreas de riego."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nodes.map((node) => (
            <div
              key={node.id}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-4"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-medium text-[var(--text-title)]">
                  {node.name || node.serial_number || `Nodo ${node.id}`}
                </span>
                <StatusBadge tone={node.is_active ? "active" : "danger"} icon={node.is_active ? CheckCircle2 : XCircle}>
                  {node.is_active ? "Activo" : "Inactivo"}
                </StatusBadge>
              </div>
              <p className="text-sm text-[var(--text-subtle)]">
                {areaName(node.irrigation_area_id)}
              </p>
            </div>
          ))}
        </div>
      )}
    </BentoCard>
  );
}

export function PropertyDetail() {
  const { selectedProperty, areas } = useSelection();
  const gatewayStatus = usePropertyGatewayStatus(selectedProperty?.id);

  if (!selectedProperty) {
    return (
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
        <EmptyState
          icon={MapPin}
          title="Selecciona un predio"
          description="Elige un predio en la lista de predios para ver sus áreas y sensores."
        />
      </div>
    );
  }

  const propertyAreas = areas.filter(a => a.property_id === selectedProperty.id);

  return (
    <PageTransition>
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
        <div className="mb-6">
          <PageHeader title={selectedProperty.name || "Propiedad"} />
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[var(--text-subtle)]">
            <span className="inline-flex items-center gap-2">
              <MapPin aria-hidden="true" className="w-4 h-4" />
              <span>{selectedProperty.location || "Chihuahua, Chihuahua"}</span>
            </span>
            {gatewayStatus && (
              <GatewayStatusBadge status={gatewayStatus.status} edgeStatus={gatewayStatus.edge_status} />
            )}
          </div>
        </div>

        <NodesPanel areas={propertyAreas} />

        {/* Areas grid */}
        <div className="mb-4">
          <h2 className="text-xl text-[var(--text-title)] mb-4">Áreas de Riego</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {propertyAreas.map((area) => (
            <AreaCard key={area.id} area={area} />
          ))}
        </div>
      </div>
    </PageTransition>
  );
}