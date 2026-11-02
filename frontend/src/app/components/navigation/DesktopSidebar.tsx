import { LogOut, Moon, Sun } from "lucide-react";
import { BrandSymbol } from "../BrandSymbol";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useModules } from "../../hooks/useModules";
import { preloadMapRoutes } from "../../services/routePreload";
import { isNavItemActive, navItemsFor } from "./items";

interface DesktopSidebarProps {
  role: "client" | "admin";
}

/** Riel lateral fijo de la identidad A: etiquetas siempre visibles, un solo acento, sin colapsar. */
export function DesktopSidebar({ role }: DesktopSidebarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const navItems = navItemsFor(role, useModules());

  const maybePreloadMaps = (path: string) => {
    if (path.includes("/mapa") || path.includes("/gateways")) void preloadMapRoutes();
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="glass-sidebar sticky top-0 flex h-screen w-[208px] shrink-0 flex-col self-start overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 pb-4 pt-5">
        <BrandSymbol className="h-10 w-10" />
        <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">Sensores Agrícolas</span>
      </div>

      <nav aria-label="Navegación principal" className="flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isNavItemActive(item, location.pathname);
          return (
            <Link
              key={item.path}
              to={item.path}
              onMouseEnter={() => maybePreloadMaps(item.path)}
              onFocus={() => maybePreloadMaps(item.path)}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-[44px] items-center gap-3 rounded-[var(--radius)] px-3 text-sm transition-colors
                focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring
                ${isActive
                  ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-[var(--hover-overlay)] hover:text-sidebar-foreground"
                }`}
            >
              <Icon aria-hidden="true" className="h-[18px] w-[18px] flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{user?.nombre || "Usuario"}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">{role === "client" ? "Productor" : "Administración"}</p>
          </div>
          <button
            onClick={toggleTheme}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius)] text-sidebar-foreground/75 transition-colors hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            aria-label={theme === "light" ? "Cambiar a tema oscuro" : "Cambiar a tema claro"}
            title="Cambiar tema"
          >
            {theme === "light" ? <Moon aria-hidden="true" className="h-5 w-5" /> : <Sun aria-hidden="true" className="h-5 w-5" />}
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius)] text-sidebar-foreground/75 transition-colors hover:bg-destructive/10 hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
