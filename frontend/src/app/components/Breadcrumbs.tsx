import { ChevronRight, type LucideIcon } from "lucide-react";
import { Link } from "react-router";

export interface Crumb {
  label: string;
  /** Sin `to` es el lugar actual. */
  to?: string;
  icon?: LucideIcon;
}

const base = "inline-flex min-h-[40px] min-w-0 max-w-full items-center gap-1.5 rounded-[var(--radius)] px-3 text-sm";

/**
 * Ruta de navegación del productor (Mis predios › Predio › Área). En móvil el primer tramo muestra solo su ícono para dar espacio a los demás. Cada tramo anterior es un botón
 * de al menos 40 px que regresa a ese nivel; el lugar actual va resaltado.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Ruta" className="mb-4">
      <ol className="flex w-full flex-nowrap items-center gap-0.5 sm:inline-flex sm:w-auto sm:max-w-full sm:flex-wrap rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-1">
        {items.map((item, i) => {
          const Icon = item.icon;
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="inline-flex min-w-0 items-center gap-0.5">
              {i > 0 && <ChevronRight aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />}
              {item.to && !last ? (
                <Link to={item.to} className={`${base} font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]`}>
                  {Icon && <Icon aria-hidden="true" className="h-4 w-4 flex-shrink-0" />}
                  <span className={`truncate ${i === 0 && Icon ? "max-sm:sr-only" : ""}`}>{item.label}</span>
                </Link>
              ) : (
                <span aria-current="page" className={`${base} bg-[var(--accent-soft)] font-semibold text-[var(--text-main)]`}>
                  {Icon && <Icon aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-[var(--accent-primary)]" />}
                  <span className="truncate">{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
