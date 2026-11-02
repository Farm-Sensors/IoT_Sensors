import { Navigate, Outlet, useLocation } from "react-router";
import { BrandSymbol } from "./BrandSymbol";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ allowedRole }: { allowedRole?: "admin" | "cliente" }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center gap-5">
        <BrandSymbol className="h-16 w-16" />
        <div className="flex items-center gap-2">
          <span
            className="block w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="block w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-bounce"
            style={{ animationDelay: "160ms" }}
          />
          <span
            className="block w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-bounce"
            style={{ animationDelay: "320ms" }}
          />
        </div>
        <p className="text-sm text-[var(--text-muted)]">Verificando sesión...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/?next=${encodeURIComponent(next)}`} replace />;
  }

  if (allowedRole && user.rol !== allowedRole) {
    return <Navigate to={user.rol === "admin" ? "/admin" : "/cliente"} replace />;
  }

  return <Outlet />;
}
