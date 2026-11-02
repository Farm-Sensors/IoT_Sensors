import { LogOut, Moon, Sun, User } from "lucide-react";
import { BrandSymbol } from "../BrandSymbol";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

/** Encabezado móvil: marca y menú de cuenta (tema y cerrar sesión), que ya no ocupan pestañas. */
export function MobileHeader({ role }: { role: "client" | "admin" }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-3">
      <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
        <BrandSymbol className="h-9 w-9" />
        Sensores Agrícolas
      </span>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Menú de cuenta"
          className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius)] border border-sidebar-border focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <User aria-hidden="true" className="h-5 w-5" />
        </button>
        {open && (
          <div role="menu" className="absolute right-0 top-12 w-56 rounded-[var(--radius)] border border-sidebar-border bg-popover p-1.5 shadow-lg">
            <p className="border-b border-sidebar-border px-3 py-2 text-sm text-muted-foreground">
              {user?.nombre || "Usuario"} · {role === "client" ? "Productor" : "Administración"}
            </p>
            <button role="menuitem" onClick={() => { toggleTheme(); setOpen(false); }} className="flex min-h-[44px] w-full items-center gap-3 rounded-[var(--radius)] px-3 text-left text-sm hover:bg-[var(--hover-overlay)]">
              {theme === "light" ? <Moon aria-hidden="true" className="h-4 w-4" /> : <Sun aria-hidden="true" className="h-4 w-4" />}
              {theme === "light" ? "Tema oscuro" : "Tema claro"}
            </button>
            <button role="menuitem" onClick={() => { logout(); navigate("/"); }} className="flex min-h-[44px] w-full items-center gap-3 rounded-[var(--radius)] px-3 text-left text-sm hover:bg-destructive/10 hover:text-destructive">
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
