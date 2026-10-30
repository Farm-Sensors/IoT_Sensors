import { Link } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { Fragment } from "react";

export interface TrailItem {
  label: string;
  /** Con `to` es un enlace; el último elemento siempre es el lugar actual. */
  to?: string;
}

/** Dónde está el admin en la jerarquía cliente → predio → área, con nombres y no IDs. */
export function HierarchyTrail({ items }: { items: TrailItem[] }) {
  return (
    <Breadcrumb aria-label="Ubicación en la jerarquía" className="mb-3">
      <BreadcrumbList>
        {items.map((item, index) => (
          <Fragment key={`${item.label}-${index}`}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {index === items.length - 1 ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : item.to ? (
                <BreadcrumbLink asChild>
                  <Link to={item.to} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center">{item.label}</Link>
                </BreadcrumbLink>
              ) : (
                <span className="text-[var(--text-muted)]">{item.label}</span>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
