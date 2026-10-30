import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

/** Clases comunes de campos de formulario del admin (tokens, foco visible, 44 px de alto). */
export const FIELD_INPUT_CLASS =
  "w-full min-h-[44px] px-4 py-2.5 rounded-[24px] bg-[var(--surface-panel)] border border-[var(--border-strong)] text-[var(--text-body)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]";

interface FieldProps {
  label: string;
  /** Un solo control (`input`, `select`, `textarea`); recibe el `id` que enlaza la etiqueta. */
  children: ReactElement<{ id?: string }>;
  hint?: ReactNode;
  className?: string;
}

/** Etiqueta visible asociada a su control (patrón 8.5). */
export function Field({ label, children, hint, className }: FieldProps) {
  const generated = useId();
  const id = isValidElement(children) && children.props.id ? children.props.id : generated;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm text-[var(--text-subtle)]">{label}</label>
      {cloneElement(children, { id })}
      {hint && <p className="mt-1 text-sm text-[var(--text-subtle)]">{hint}</p>}
    </div>
  );
}
