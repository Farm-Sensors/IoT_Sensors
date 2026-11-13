import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTheme } from "../../../context/ThemeContext";
import { AlertTriangle, Ban, CheckCircle2, MinusCircle, type LucideIcon } from "lucide-react";
import { AREA_STATE_LABEL, type AreaState, type SeriesPoint } from "./areaStatus";

export const STATE_ICON: Record<AreaState, LucideIcon> = {
  al_dia: CheckCircle2,
  sin_comunicacion: AlertTriangle,
  sin_datos: MinusCircle,
  sin_nodo: Ban,
};

/** Estado con icono y texto: nunca solo color. */
export function StateBadge({ state }: { state: AreaState }) {
  const Icon = STATE_ICON[state];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold" style={{ color: state === "sin_comunicacion" ? "var(--status-danger-text)" : state === "al_dia" ? "var(--status-success-solid)" : "var(--text-muted)" }}>
      <Icon aria-hidden="true" className="h-4 w-4" />
      {AREA_STATE_LABEL[state]}
    </span>
  );
}

/** Contenedor desplazable que arranca en el extremo derecho: ahí está lo más reciente (útil en móvil). */
function ChartBox({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth; }, [children]);
  return (
    <div ref={ref} className="max-w-full overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-2" tabIndex={0} role="region" aria-label={label}>
      {children}
    </div>
  );
}

/**
 * Ancho real del contenedor: el SVG se dibuja en píxeles reales, así los rótulos conservan su tamaño
 * (11 px) en cualquier pantalla en vez de crecer con el ancho. Por debajo de `min` el contenedor se desplaza.
 */
function useChartWidth(min: number): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(min);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(min, Math.floor(el.clientWidth - 18)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [min]);
  return [ref, width];
}

const H = 240;
const fmtHour = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:00`;
// Paleta categórica validada (orden fijo: el color sigue al área, nunca a su posición en la lista visible).
const SERIES_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const SERIES_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

/**
 * Una línea de humedad por área, cada una con su color; la leyenda (nombre completo y última cifra)
 * identifica cada línea y al pasar el puntero una guía vertical muestra el valor de todas a esa hora.
 */
export function HumidityChart({ series, now }: { series: { name: string; points: SeriesPoint[] }[]; now: number }) {
  const { theme } = useTheme();
  const colors = theme === "dark" ? SERIES_DARK : SERIES_LIGHT;
  const [hover, setHover] = useState<number | null>(null);
  const [boxRef, W] = useChartWidth(520);
  const usable = series.map((s, n) => ({ ...s, n, color: colors[n % colors.length], pts: s.points.filter((p) => p.humidity !== null) })).filter((s) => s.pts.length);
  if (!usable.length) return <p className="rounded-[var(--radius)] border border-[var(--border)] p-6 text-sm text-[var(--text-muted)]">Ninguna área reportó humedad en las últimas 24 horas.</p>;
  const L = 38, R = 12, T = 12, B = 26;
  const all = usable.flatMap((s) => s.pts.map((p) => p.humidity as number));
  const lo = Math.floor(Math.min(...all) - 2), hi = Math.ceil(Math.max(...all) + 2);
  const t1 = now, t0 = now - 24 * 3600_000;
  const x = (t: number) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const last = (s: (typeof usable)[number]) => s.pts[s.pts.length - 1].humidity as number;
  const label = usable.map((s) => `${s.name}: ${last(s).toFixed(1)} %`).join(". ");

  // Punto más cercano de cada serie al instante señalado.
  const at = hover === null ? null : t0 + ((hover - L) / (W - L - R)) * (t1 - t0);
  const near = at === null ? [] : usable.map((s) => {
    const p = s.pts.reduce((best, q) => (Math.abs(q.t.getTime() - at) < Math.abs(best.t.getTime() - at) ? q : best));
    return { s, p };
  });
  const when = near.length ? near[0].p.t : null;
  const gx = when ? x(when.getTime()) : null;
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    setHover(Math.min(W - R, Math.max(L, px)));
  };

  return (
    <div ref={boxRef}>
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Leyenda: qué línea es cada área">
        {usable.map((s) => (
          <li key={s.name} className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-[3px] w-5 rounded-full" style={{ background: s.color }} />
            <span className="font-medium">{s.name}</span>
            <span className="font-mono-data text-[var(--text-muted)]">{last(s).toFixed(1)} %</span>
          </li>
        ))}
      </ul>
      <ChartBox label="Gráfica de humedad por área">
        <div className="relative" style={{ width: W }}>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block touch-pan-x" role="img" aria-label={`Humedad del suelo por área, últimas 24 horas. ${label}`}
            onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
            {[lo, (lo + hi) / 2, hi].map((v) => (
              <g key={v}>
                <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--border)" />
                <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{v.toFixed(0)} %</text>
              </g>
            ))}
            {usable.map((s) => (
              <polyline key={s.name} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
                points={s.pts.map((p) => `${x(p.t.getTime()).toFixed(1)},${y(p.humidity as number).toFixed(1)}`).join(" ")} />
            ))}
            {usable.map((s) => <circle key={s.name} cx={x(s.pts[s.pts.length - 1].t.getTime())} cy={y(last(s))} r="3.5" fill={s.color} stroke="var(--card)" strokeWidth="2" />)}
            {gx !== null && (
              <g pointerEvents="none">
                <line x1={gx} x2={gx} y1={T} y2={H - B} stroke="var(--text-muted)" strokeDasharray="3 3" />
                {near.map(({ s, p }) => <circle key={s.name} cx={gx} cy={y(p.humidity as number)} r="4" fill={s.color} stroke="var(--card)" strokeWidth="2" />)}
              </g>
            )}
            {[0, 6, 12, 18, 24].map((k) => {
              const t = new Date(t0 + k * 3600_000);
              return <text key={k} x={x(t.getTime())} y={H - 6} fontSize="11" fill="var(--text-muted)" textAnchor={k === 0 ? "start" : k === 24 ? "end" : "middle"}>{k === 24 ? "ahora" : fmtHour(t)}</text>;
            })}
          </svg>
          {gx !== null && when && (
            <div role="status" className="pointer-events-none absolute top-1 z-10 min-w-[170px] rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-2 text-xs shadow-sm"
              style={gx / W > 0.6 ? { right: `${(1 - gx / W) * 100 + 1}%` } : { left: `${(gx / W) * 100 + 1}%` }}>
              <div className="mb-1 font-semibold">{when.toLocaleString("es-MX", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
              {near.map(({ s, p }) => (
                <div key={s.name} className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}</span>
                  <span className="font-mono-data">{(p.humidity as number).toFixed(1)} %</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </ChartBox>
    </div>
  );
}

/** Litros por hora de las últimas 24 h. */
export function LitersChart({ buckets }: { buckets: { start: Date; liters: number | null }[] }) {
  const [boxRef, W] = useChartWidth(380);
  const L = 58, R = 8, T = 12, B = 26;
  const measured = buckets.flatMap((b) => (b.liters === null ? [] : [b.liters]));
  // Eje con extremos enteros y distintos: nunca «0, 1, 1».
  const max = Math.max(2, Math.ceil(Math.max(0, ...measured) * 1.1 / 2) * 2);
  const bw = (W - L - R) / buckets.length;
  const total = measured.reduce((a, b) => a + b, 0);
  if (measured.length === 0) {
    return <div ref={boxRef}><p className="py-8 text-center text-sm text-[var(--text-muted)]">Sin datos de flujo en las últimas 24 h.</p></div>;
  }
  return (
    <div ref={boxRef}><ChartBox label="Gráfica de flujo de agua">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block" role="img" aria-label={`Litros de agua por hora, últimas 24 horas. Total ${Math.round(total)} litros.`}>
        {[0, max / 2, max].map((v) => {
          const yy = T + (1 - v / max) * (H - T - B);
          return (
            <g key={v}>
              <line x1={L} x2={W - R} y1={yy} y2={yy} stroke="var(--border)" />
              <text x={L - 6} y={yy + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{Math.round(v)}</text>
            </g>
          );
        })}
        {buckets.map((b, i) => {
          const h = ((b.liters ?? 0) / max) * (H - T - B);
          return (
            <g key={i}>
              <rect x={L + i * bw + 2} y={H - B - h} width={bw - 4} height={h} fill="var(--accent-primary)" />
              {i % 6 === 0 && <text x={L + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{fmtHour(b.start)}</text>}
            </g>
          );
        })}
      </svg>
    </ChartBox></div>
  );
}
