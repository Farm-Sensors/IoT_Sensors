import { useCallback, useEffect, useRef, useState } from "react";
import { GeoNode, getGeoNodes } from "../../services/nodes";

const MAP_AUTO_REFRESH_MS = 30_000;

export interface UseGeoNodesDataOptions {
  clientId?: number | null;
  propertyId?: number | null;
  areaId?: number | null;
  errorMessage: string;
  /** Limpia la capa actual cuando el fetch falla (admin). */
  clearOnError?: boolean;
}

export function useGeoNodesData(options: UseGeoNodesDataOptions) {
  const [nodes, setNodes] = useState<GeoNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

  const { clientId, propertyId, areaId, errorMessage, clearOnError = false } = options;

  const refresh = useCallback(async () => {
    const requestSeq = ++requestSeqRef.current;
    try {
      setLoading(true);
      setError(null);

      const response = await getGeoNodes({
        per_page: 200,
        include_without_coordinates: true,
        client_id: clientId ?? undefined,
        property_id: propertyId ?? undefined,
        irrigation_area_id: areaId ?? undefined,
      });

      if (requestSeq !== requestSeqRef.current) return;
      setNodes(response.data);
    } catch (err) {
      if (requestSeq !== requestSeqRef.current) return;
      console.error("Error fetching geo nodes", err);
      setError(errorMessage);
      if (clearOnError) setNodes([]);
    } finally {
      if (requestSeq !== requestSeqRef.current) return;
      setLoading(false);
    }
  }, [clientId, propertyId, areaId, errorMessage, clearOnError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.hidden) return;
      void refresh();
    }, MAP_AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  return { nodes, loading, error, refresh };
}
