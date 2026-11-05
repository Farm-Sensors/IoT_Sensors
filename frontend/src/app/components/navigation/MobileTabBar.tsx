import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import { useModules } from "../../hooks/useModules";
import { preloadMapRoutes } from "../../services/routePreload";
import { isNavItemActive, navItemsFor } from "./items";

interface MobileTabBarProps {
  role: "client" | "admin";
}

/**
 * Pestañas inferiores: todos los destinos visibles. Con 6 o menos ocupan el ancho por igual
 * (el admin con Fase 2 encendida llega a 6); si hubiera más, la barra se desplaza por dentro.
 * Tema y «Cerrar sesión» viven en el encabezado móvil, no aquí.
 */
export function MobileTabBar({ role }: MobileTabBarProps) {
  const location = useLocation();
  const tabs = navItemsFor(role, useModules());
  const activeRef = useRef<HTMLAnchorElement>(null);
  const scrolls = tabs.length > 6;

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ inline: "center", block: "nearest" });
  }, [location.pathname]);

  const maybePreloadMaps = (path: string) => {
    if (path.includes("/mapa") || path.includes("/gateways")) void preloadMapRoutes();
  };

  return (
    <nav
      aria-label="Navegación principal"
      className="safe-area-inset-bottom fixed bottom-0 left-0 right-0 z-50 border-t border-sidebar-border bg-sidebar"
    >
      <div
        className={scrolls ? "flex overflow-x-auto" : "grid"}
        style={scrolls ? { scrollbarWidth: "none" } : { gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = isNavItemActive(tab, location.pathname);
          return (
            <Link
              key={tab.path}
              ref={isActive ? activeRef : undefined}
              to={tab.path}
              onMouseEnter={() => maybePreloadMaps(tab.path)}
              onFocus={() => maybePreloadMaps(tab.path)}
              onTouchStart={() => maybePreloadMaps(tab.path)}
              aria-current={isActive ? "page" : undefined}
              aria-label={tab.mobileLabel ?? tab.label}
              className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 border-t-[3px] px-0.5 text-[11px] font-semibold transition-colors
                focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-ring
                ${scrolls ? "min-w-[72px] flex-shrink-0" : ""}
                ${isActive
                  ? "border-[var(--accent-primary)] bg-sidebar-accent text-sidebar-accent-foreground"
                  : "border-transparent text-sidebar-foreground/70"
                }`}
            >
              <Icon aria-hidden="true" className="h-[22px] w-[22px]" />
              <span className="whitespace-nowrap">{tab.mobileLabel ?? tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
