import { useEffect, useState } from "react";
import { FRESH_MINUTES_THRESHOLD } from "../pages/client/dashboard/helpers";
import { AREA_STATE_LABEL, formatAgo, minutesSince } from "../pages/client/overview/areaStatus";
import { formatStamp } from "../utils/metricFormat";

interface FreshnessIndicatorProps {
  lastUpdate: Date;
  variant?: "light" | "dark";
}

/** Frescura de un área o nodo: estado («Datos actuales» / «Sin comunicación») y «Último dato 13/11 15:04 · hace 12 min». */
export function FreshnessIndicator({ lastUpdate, variant = "light" }: FreshnessIndicatorProps) {
  const [, forceUpdate] = useState(0);

  // Keep elapsed time and freshness current even without a new reading.
  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const minutesAgo = minutesSince(lastUpdate);
  const fresh = minutesAgo < FRESH_MINUTES_THRESHOLD;
  const dotColor = fresh ? "var(--status-active)" : "var(--status-warning)";
  const statusLabel = fresh ? "Datos actuales" : AREA_STATE_LABEL.sin_comunicacion;
  const ago = formatAgo(minutesAgo);
  const textColor = variant === "dark" ? "text-[var(--text-on-dark)]/70" : "text-[var(--text-muted)]";

  return (
    <div
      className={`flex items-start gap-2 text-sm ${textColor}`}
      title={`${statusLabel}. Último dato recibido ${ago}.`}
    >
      <span className="relative mt-1.5 flex h-2.5 w-2.5 flex-shrink-0 items-center justify-center">
        {/* Pulsing ring when fresh */}
        {fresh && (
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
        <span>Último dato <time dateTime={lastUpdate.toISOString()}>{formatStamp(lastUpdate)}</time> · {ago}</span>
      </span>
    </div>
  );
}
