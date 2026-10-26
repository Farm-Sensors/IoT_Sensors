import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { preloadMapRoutes } from "../../services/routePreload";
import { useModules } from "../../hooks/useModules";
import { navItemsFor } from "./items";

interface DesktopSidebarProps {
  role: "client" | "admin";
}

export function DesktopSidebar({ role }: DesktopSidebarProps) {
  const [expanded, setExpanded] = useState(true);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSidebarToggle = () => {
    setExpanded((previous) => {
      const next = !previous;
      if (next) {
        void preloadMapRoutes();
      }
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const maybePreloadMaps = (path: string) => {
    if (path.includes("/mapa")) {
      void preloadMapRoutes();
    }
  };

  const navItems = navItemsFor(role, useModules());
  const homePath = role === "client" ? "/cliente" : "/admin";

  return (
    <div
      className={`glass-sidebar ${expanded ? "w-[272px]" : "w-[76px]"} h-screen sticky top-0 self-start shrink-0 overflow-hidden border-r border-[var(--sidebar-border)] transition-all duration-300 flex flex-col`}
    >
      {/* Logo */}
      <div className="px-4 py-6 flex items-center justify-between min-h-[88px] gap-2 border-b border-[var(--sidebar-border)]">
        <div
          className={`overflow-hidden transition-all duration-300 ${expanded ? "flex-1 opacity-100" : "w-0 opacity-0 hidden"}`}
        >
          <h2 className="font-serif text-xl leading-tight text-sidebar-foreground whitespace-nowrap">
            Sensores Agrícolas
          </h2>
          <p className="mt-1 text-xs text-sidebar-foreground/60 whitespace-nowrap">Monitoreo de riego IoT</p>
        </div>
        <button
          onClick={handleSidebarToggle}
          className="p-2 rounded-full hover:bg-sidebar-accent transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label={expanded ? "Colapsar menú" : "Expandir menú"}
        >
          {expanded ? (
            <ChevronLeft className="w-5 h-5 text-sidebar-foreground/70" />
          ) : (
            <ChevronRight className="w-5 h-5 text-sidebar-foreground/70" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto space-y-2 pb-4 pt-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const currentPath = location.pathname.replace(/\/+$/, "") || "/";
          const itemPath = item.path.replace(/\/+$/, "") || "/";
          const isHomeItem = itemPath === homePath;
          const isActive =
            currentPath === itemPath ||
            (!isHomeItem && currentPath.startsWith(`${itemPath}/`));

          return (
            <Link
              key={item.path}
              to={item.path}
              onMouseEnter={() => maybePreloadMaps(item.path)}
              onFocus={() => maybePreloadMaps(item.path)}
              aria-current={isActive ? "page" : undefined}
              title={!expanded ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-3 rounded-full transition-all
                focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1
                ${expanded ? "mx-2" : "justify-center mx-auto"}
                ${isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span
                className={`font-medium overflow-hidden transition-all duration-300 whitespace-nowrap ${
                  expanded ? "max-w-[200px] opacity-100" : "max-w-0 opacity-0"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="py-4 border-t border-sidebar-border relative bg-[var(--sidebar)]/70">
        <div className={`flex items-center ${expanded ? "justify-between px-4" : "justify-center flex-col gap-4"}`}>
          <div className="w-10 h-10 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-medium text-base flex-shrink-0">
            {user?.nombre ? user.nombre.charAt(0).toUpperCase() : (role === "client" ? "C" : "A")}
          </div>

          <div
            className={`transition-all duration-300 overflow-hidden ${
              expanded ? "flex-1 min-w-0 px-3 opacity-100" : "w-0 h-0 opacity-0 hidden"
            }`}
          >
            <p className="font-medium text-sidebar-foreground text-sm truncate">{user?.nombre || "Usuario"}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{role === "client" ? "Cliente" : "Admin"}</p>
          </div>

          <div className={`flex items-center ${expanded ? "gap-1" : "flex-col gap-3"}`}>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-sidebar-accent hover:text-sidebar-foreground text-sidebar-foreground/70 transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              aria-label={theme === "light" ? "Cambiar a tema oscuro" : "Cambiar a tema claro"}
              title="Cambiar tema"
            >
              {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            <button
              onClick={handleLogout}
              className="p-2 rounded-full hover:bg-destructive/10 hover:text-destructive text-sidebar-foreground/70 transition-colors flex-shrink-0
                focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
