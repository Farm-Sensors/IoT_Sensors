import { LogOut, Moon, Sun } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { preloadMapRoutes } from "../../services/routePreload";
import { useModules } from "../../hooks/useModules";
import { navItemsFor } from "./items";

interface MobileTabBarProps {
  role: "client" | "admin";
}

export function MobileTabBar({ role }: MobileTabBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const maybePreloadMaps = (path: string) => {
    if (path.includes("/mapa")) {
      void preloadMapRoutes();
    }
  };

  const tabs = navItemsFor(role, useModules());

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 glass-sidebar border-t border-sidebar-border safe-area-inset-bottom z-50">
      {/* Scrollable container with fade edges */}
      <div className="relative">
        {/* Left fade */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-sidebar to-transparent z-10" />
        {/* Right fade */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-sidebar to-transparent z-10" />

        <div
          className="flex items-center gap-1 px-3 py-2 overflow-x-auto scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              location.pathname === tab.path ||
              (tab.path !== (role === "client" ? "/cliente" : "/admin") &&
                location.pathname.startsWith(tab.path));

            return (
              <Link
                key={tab.path}
                to={tab.path}
                onMouseEnter={() => maybePreloadMaps(tab.path)}
                onFocus={() => maybePreloadMaps(tab.path)}
                onTouchStart={() => maybePreloadMaps(tab.path)}
                aria-current={isActive ? "page" : undefined}
                aria-label={tab.mobileLabel ?? tab.label}
                className={`
                  flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl
                  transition-colors flex-shrink-0 min-w-[56px]
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring
                  ${isActive ? "bg-sidebar-primary/16" : "hover:bg-sidebar-accent"}
                `}
              >
                <Icon
                  className={`w-5 h-5 transition-colors ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70"}`}
                />
                <span
                  className={`text-[10px] font-medium leading-tight transition-colors whitespace-nowrap ${
                    isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70"
                  }`}
                >
                  {tab.mobileLabel ?? tab.label}
                </span>
              </Link>
            );
          })}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className={`
              flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl
              transition-colors flex-shrink-0 min-w-[56px]
              focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring
              hover:bg-sidebar-accent
            `}
            aria-label="Cambiar tema"
          >
            {theme === "light" ? (
              <Moon className="w-5 h-5 text-sidebar-foreground/70" />
            ) : (
              <Sun className="w-5 h-5 text-sidebar-foreground/70" />
            )}
            <span className="text-[10px] font-medium leading-tight text-sidebar-foreground/70 whitespace-nowrap">
              Tema
            </span>
          </button>

          <button
            onClick={handleLogout}
            className={`
              flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl
              transition-colors flex-shrink-0 min-w-[56px]
              focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring
              hover:bg-sidebar-accent
            `}
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-5 h-5 text-sidebar-foreground/70" />
            <span className="text-[10px] font-medium leading-tight text-sidebar-foreground/70 whitespace-nowrap">
              Salir
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
