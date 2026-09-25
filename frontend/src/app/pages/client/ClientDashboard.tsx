import { ChevronDown, Database } from "lucide-react";
import { MetricSkeletonGrid } from "../../components/MetricSkeleton";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useSelection } from "../../context/SelectionContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { usePageVisibility } from "../../hooks/usePageVisibility";
import { api } from "../../services/api";
import { EmptyState } from "../../components/EmptyState";
import { FreshnessIndicator } from "../../components/FreshnessIndicator";
import { GatewayStatusBadge } from "../../components/GatewayStatusBadge";
import { usePropertyGatewayStatus } from "../../hooks/usePropertyGatewayStatus";
import type { PaginatedResponse, ReadingResponse } from "../../types/api";
import { toCurrentReadings, toChartReadings, type ChartReading } from "./dashboard/readings";
import { ExternalDataCards } from "./dashboard/ExternalDataCards";
import {
  DASHBOARD_REFRESH_MS,
  defaultSemaphore,
  getConnectionState,
  type PriorityKey,
  type PriorityStatusItem,
  type SemaphoreLevel,
} from "./dashboard/helpers";
export function ClientDashboard() {
  const isMobile = useIsMobile();
  const isPageVisible = usePageVisibility();
  const { user } = useAuth();
  const {
    properties,
    areas,
    selectedProperty,
    selectedArea,
    setSelectedProperty,
    setSelectedArea
  } = useSelection();

  const gatewayStatus = usePropertyGatewayStatus(selectedProperty?.id);
  const filteredAreas = selectedProperty
    ? areas.filter(a => a.property_id === selectedProperty.id)
    : [];

  const areaId = selectedArea?.id;
  const [snapshot, setSnapshot] = useState<{
    areaId: number;
    reading: ReadingResponse | null;
    history: ChartReading[];
    semaphore: Record<PriorityKey, SemaphoreLevel>;
    error: string | null;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const [, tick] = useState(0);
  const activeSnapshot = snapshot?.areaId === areaId ? snapshot : null;
  const loading = Boolean(areaId && !activeSnapshot);
  const currentReadings = toCurrentReadings(activeSnapshot?.reading ?? null);
  const connectionState = getConnectionState(currentReadings.lastUpdate);

  useEffect(() => {
    const timer = window.setInterval(() => tick((value) => value + 1), DASHBOARD_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedProperty && filteredAreas.length > 0 && !selectedArea) {
      setSelectedArea(filteredAreas[0]);
    }
  }, [selectedProperty, filteredAreas, selectedArea, setSelectedArea]);

  useEffect(() => {
    if (!areaId || !isPageVisible) return;
    let cancelled = false;
    let inFlight = false;
    const fetchData = async () => {
      if (inFlight) return;
      inFlight = true;
      const params = { irrigation_area_id: areaId };
      const [latest, history, priority] = await Promise.allSettled([
        api.get<ReadingResponse | null>("/readings/latest", { params }),
        api.get<PaginatedResponse<ReadingResponse>>("/readings", { params: { ...params, page: 1, per_page: 12 } }),
        api.get<{ items: PriorityStatusItem[] }>("/readings/priority-status", { params }),
      ]);
      inFlight = false;
      if (cancelled) return;
      const semaphore = { ...defaultSemaphore };
      if (priority.status === "fulfilled") {
        for (const item of priority.value.data.items ?? []) {
          if (item.parameter in semaphore &&
            (item.level === "optimal" || item.level === "warning" || item.level === "critical")) {
            semaphore[item.parameter as PriorityKey] = item.level;
          }
        }
      }
      const latestReading = latest.status === "fulfilled" ? latest.value.data : null;
      if (latestReading?.soil?.humidity == null) semaphore["soil.humidity"] = null;
      if (latestReading?.irrigation?.flow_per_minute == null) semaphore["irrigation.flow_per_minute"] = null;
      if (latestReading?.environmental?.eto == null) semaphore["environmental.eto"] = null;
      setSnapshot({
        areaId,
        reading: latestReading,
        history: history.status === "fulfilled" ? toChartReadings(history.value.data.data) : [],
        semaphore,
        error: latest.status === "rejected" ? "No se pudo cargar la última lectura." :
          history.status === "rejected" ? "No se pudieron cargar las lecturas recientes." : null,
      });
    };
    void fetchData();
    const timer = window.setInterval(() => void fetchData(), DASHBOARD_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [areaId, isPageVisible, retry]);


  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 overflow-x-hidden">
      {/* Header */}
      <div className="mb-6 md:mb-8 animate-fade-in-up">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="mb-1 text-2xl md:text-3xl text-[var(--text-title)]">
              Hola, {user?.nombre || 'Usuario'}
            </h1>
            <p className="text-[var(--text-subtle)]">
              {new Date().toLocaleDateString("es-MX", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Breadcrumb selectors */}
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <select
              className="appearance-none cursor-pointer rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] py-2 pl-4 pr-10 font-medium text-[var(--text-body)] transition-colors hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              value={selectedProperty?.id ?? ""}
              onChange={(e) => {
                const prop = properties.find(p => p.id === Number(e.target.value));
                setSelectedProperty(prop || null);
                setSelectedArea(null);
              }}
            >
              <option value="" disabled>Seleccione predio...</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
          </div>

          {(selectedProperty || filteredAreas.length > 0) && (
            <div className="relative">
              <select
                className="appearance-none cursor-pointer rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] py-2 pl-4 pr-10 font-medium text-[var(--text-body)] transition-colors hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                value={selectedArea?.id ?? ""}
                onChange={(e) => {
                  const area = areas.find(a => a.id === Number(e.target.value));
                  setSelectedArea(area || null);
                }}
              >
                <option value="" disabled>Seleccione área...</option>
                {filteredAreas.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {currentReadings.lastUpdate && <FreshnessIndicator lastUpdate={currentReadings.lastUpdate} />}
            {gatewayStatus && (
              <GatewayStatusBadge status={gatewayStatus.status} edgeStatus={gatewayStatus.edge_status} />
            )}
          </div>

        </div>
      </div>

      {!selectedArea ? (
        <EmptyState icon={Database} title="Selecciona un área de riego" />
      ) : (
        <>
          {activeSnapshot?.error && (
            <div role="alert" className="mb-4 rounded-2xl bg-[var(--status-danger-bg)] p-4 text-[var(--status-danger)]">
              <p>{activeSnapshot.error}</p>
              <button type="button" className="mt-2 underline" onClick={() => setRetry((value) => value + 1)}>Reintentar</button>
            </div>
          )}
          {loading ? <div role="status" aria-label="Cargando lecturas"><MetricSkeletonGrid count={isMobile ? 3 : 6} /></div> : !activeSnapshot?.reading ? (
            !activeSnapshot?.error && <EmptyState icon={Database} title="Sin lecturas" description="Esta área todavía no tiene datos de sensores." />
          ) : isMobile ? (
            <MobileDashboard
              historicalData={activeSnapshot.history}
              currentReadings={currentReadings}
              prioritySemaphore={activeSnapshot.semaphore}
              connectionState={connectionState}
            />
          ) : (
            <DesktopDashboard
              historicalData={activeSnapshot.history}
              currentReadings={currentReadings}
              prioritySemaphore={activeSnapshot.semaphore}
              connectionState={connectionState}
              gatewayStatus={gatewayStatus?.status}
              gatewayEdgeStatus={gatewayStatus?.edge_status}
            />
          )}
          <ExternalDataCards key={selectedArea.id} areaId={selectedArea.id} />
        </>
      )}
    </div>
  );
}

import { DesktopDashboard } from "./dashboard/DesktopDashboard";
import { MobileDashboard } from "./dashboard/MobileDashboard";
