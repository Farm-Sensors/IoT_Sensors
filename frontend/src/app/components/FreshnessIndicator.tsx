import { useEffect, useState } from "react";
import { FRESH_MINUTES_THRESHOLD } from "../pages/client/dashboard/helpers";

interface FreshnessIndicatorProps {
  lastUpdate: Date;
  variant?: "light" | "dark";
}

function getTimeText(minutesAgo: number): string {
  if (minutesAgo < 1) return "hace un momento";
  if (minutesAgo < 60) return `hace ${minutesAgo} min`;
  const hours = Math.floor(minutesAgo / 60);
  const mins = minutesAgo % 60;
  return mins > 0 ? `hace ${hours}h ${mins}min` : `hace ${hours}h`;
}

export function FreshnessIndicator({ lastUpdate, variant = "light" }: FreshnessIndicatorProps) {
  const [, forceUpdate] = useState(0);

  // Keep elapsed time and freshness current even without a new reading.
  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  let minutesAgo = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60));
  if (minutesAgo < 0) minutesAgo = 0;

  let dotColor: string;
  let statusLabel: string;

  if (minutesAgo < FRESH_MINUTES_THRESHOLD) {
    dotColor = "var(--status-active)";
    statusLabel = "Datos actuales";
  } else {
    dotColor = "var(--status-warning)";
    statusLabel = "Sin reporte reciente";
  }

  const textColor = variant === "dark" ? "text-[var(--text-on-dark)]/70" : "text-[var(--text-muted)]";
  const isPulsing = minutesAgo < FRESH_MINUTES_THRESHOLD;

  return (
    <div
      className={`flex items-start gap-2 text-sm ${textColor}`}
      title={`Estado del nodo: ${statusLabel}. Último dato recibido ${getTimeText(minutesAgo)}.`}
    >
      <span className="relative mt-1.5 flex h-2.5 w-2.5 flex-shrink-0 items-center justify-center">
        {/* Pulsing ring when fresh */}
        {isPulsing && (
          <span
            className="absolute inline-flex w-full h-full rounded-full opacity-60"
            style={{
              backgroundColor: dotColor,
              animation: "rippleExpand 2s ease-out infinite",
            }}
          />
        )}
        <span
          className="relative block w-2 h-2 rounded-full"
          style={{ backgroundColor: dotColor }}
          aria-hidden="true"
        />
      </span>
      <span className="flex flex-col">
        <span className="font-medium">{statusLabel}</span>
        <span>Último dato: <time dateTime={lastUpdate.toISOString()}>{lastUpdate.toLocaleString("es-MX")}</time> · {getTimeText(minutesAgo)}</span>
      </span>
    </div>
  );
}
