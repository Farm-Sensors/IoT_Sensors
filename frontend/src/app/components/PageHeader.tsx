import { type ReactNode, type Ref } from "react";

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
