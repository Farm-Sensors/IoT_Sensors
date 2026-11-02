import { Link, useLocation } from "react-router";
import { isSectionTabActive, sectionTabsFor } from "./items";

/** Pestañas de sección del admin (Clientes, Red, Ajustes): llevan a las pantallas hermanas. */
export function SectionTabs() {
  const { pathname } = useLocation();
  const tabs = sectionTabsFor(pathname);
  if (!tabs) return null;
  return (
    <nav aria-label="Secciones" className="flex gap-1 overflow-x-auto border-b border-[var(--border)] px-4 pt-3 md:px-8" style={{ scrollbarWidth: "none" }}>
      {tabs.map((tab) => {
        const active = isSectionTabActive(tab, pathname);
        return (
          <Link
            key={tab.path}
            to={tab.path}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex min-h-[44px] items-center whitespace-nowrap border-b-[3px] px-4 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]
              ${active ? "border-[var(--accent-primary)] font-semibold text-[var(--text-main)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
