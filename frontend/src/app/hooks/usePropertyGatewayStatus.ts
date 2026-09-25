import { useEffect, useState } from "react";
import { GatewayStatus, getPropertyGatewayStatus } from "../services/gateways";

export function usePropertyGatewayStatus(propertyId?: number | null) {
  const [status, setStatus] = useState<GatewayStatus | null>(null);

  useEffect(() => {
    if (!propertyId) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    getPropertyGatewayStatus(propertyId)
      .then((res) => {
        if (!cancelled) setStatus(res.data);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  return status;
}
