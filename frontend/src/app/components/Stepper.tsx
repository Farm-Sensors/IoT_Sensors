import { Check } from "lucide-react";

interface StepperProps {
  steps: string[];
  /** Índice (desde 0) del paso actual. */
  current: number;
  label?: string;
}

/** Pasos de un flujo: el actual lleva `aria-current="step"` y el avance se dice con texto e icono. */
export function Stepper({ steps, current, label = "Pasos" }: StepperProps) {
  return (
    <div>
      <p className="mb-2 text-sm text-[var(--text-muted)]">
        Paso {current + 1} de {steps.length}
      </p>
      <ol aria-label={label} className="space-y-2">
        {steps.map((title, index) => {
          const done = index < current;
          const isCurrent = index === current;
          return (
            <li
              key={title}
              aria-current={isCurrent ? "step" : undefined}
              className={`flex items-center gap-3 text-sm ${
                isCurrent ? "font-semibold text-[var(--text-main)]" : "text-[var(--text-muted)]"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-xs ${
                  isCurrent
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--text-inverted)]"
                    : done
                      ? "border-[var(--accent-primary)] text-[var(--accent-primary)]"
                      : "border-[var(--border-strong)]"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span>
                {title}
                {done && <span className="sr-only"> (completado)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
