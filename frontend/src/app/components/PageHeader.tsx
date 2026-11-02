import { type ReactNode, type Ref } from "react";
import { useEmbedded } from "./EmbeddedPanel";

interface PageHeaderProps {
  title: string;
  /** Una sola línea de apoyo. */
  subtitle?: string;
  /** Como máximo una acción primaria; en móvil pasa debajo, a ancho completo. */
  action?: ReactNode;
  /** Para mover el foco al encabezado al cambiar de paso o de ruta. */
  headingRef?: Ref<HTMLHeadingElement>;
}

/** Encabezado de página: el único `h1`, subtítulo opcional y una acción primaria. */
export function PageHeader({ title, subtitle, action, headingRef }: PageHeaderProps) {
  // Dentro del Directorio el único h1 es el de la página; aquí el título baja a h2.
  const embedded = useEmbedded();
  if (embedded && !title) return action ? <div className="mb-4 flex justify-end">{action}</div> : null;
  if (embedded) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-[var(--text-main)] focus:outline-none">{title}</h2>
          {subtitle && <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0 max-sm:[&>*]:w-full">{action}</div>}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mb-1 font-serif text-2xl text-[var(--text-main)] focus:outline-none md:text-3xl"
        >
          {title}
        </h1>
        {subtitle && <p className="text-[var(--text-muted)]">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0 max-md:[&>*]:w-full">{action}</div>}
    </div>
  );
}
