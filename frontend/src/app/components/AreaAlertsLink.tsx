import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useModules } from "../hooks/useModules";
import { listAlerts } from "../services/alerts";

/**
 * Área › Ahora: «N alertas sin leer» con enlace a las alertas de esa área.
 * No muestra nada con el módulo apagado, sin alertas sin leer o si la consulta falla (no pide nada si el módulo está apagado).
 */
export function AreaAlertsLink({ areaId }: { areaId: number }) {
  const enabled = useModules().alerts;
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    listAlerts({ irrigation_area_id: areaId, read: false, page: 1, per_page: 1 })
      .then((r) => { if (!cancelled) setUnread(r.total); })
      .catch(() => { if (!cancelled) setUnread(0); });
    return () => { cancelled = true; };
  }, [enabled, areaId]);

  if (!enabled || unread === 0) return null;
  return (
    <Link
      to={`/cliente/alertas?area=${areaId}`}
      className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius)] bg-[var(--status-warning-bg)] px-3 text-sm font-semibold text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      <Bell aria-hidden="true" className="h-4 w-4 text-[var(--status-warning-text)]" />
      {unread === 1 ? "1 alerta sin leer" : `${unread} alertas sin leer`}
    </Link>
  );
}
