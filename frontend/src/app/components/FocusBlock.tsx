import type { ReactNode } from "react";

interface FocusBlockProps {
  /** Qué mide la cifra («áreas al día», «sin leer»…). */
  label: string;
  value: ReactNode;
  /** Una línea de contexto bajo la cifra. */
  hint?: ReactNode;
  className?: string;
}

/**
 * El dato principal de la pantalla en un bloque verde sólido: un solo punto focal por pantalla,
 * con el resto en tarjetas blancas rectas. Los colores internos vienen de `.focus-block` (theme.css).
 */
export function FocusBlock({ label, value, hint, className = "" }: FocusBlockProps) {
  return (
    <section aria-label={label} className={`focus-block rounded-[var(--radius)] px-5 py-4 ${className}`}>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`${typeof value === "string" ? "text-3xl" : "text-4xl"} font-semibold leading-none tabular-nums`}>{value}</span>
        <span className="text-base font-semibold">{label}</span>
      </p>
      {hint && <p className="mt-1.5 text-sm text-[var(--text-muted)]">{hint}</p>}
    </section>
  );
}
