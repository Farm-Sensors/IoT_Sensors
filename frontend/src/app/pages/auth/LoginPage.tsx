import { jwtDecode } from "jwt-decode";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AuthSplitLayout } from "../../components/auth/AuthSplitLayout";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, user } = useAuth();
  const nextPath = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Tras un error, el foco va al primer campo a revisar (los campos se reactivan al terminar la carga).
  useEffect(() => {
    if (!error || isLoading) return;
    if (email.trim()) {
      passwordRef.current?.focus();
      passwordRef.current?.select();
    } else {
      emailRef.current?.focus();
    }
  }, [error, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(resolvePostLoginPath(user.rol, nextPath));
    }
  }, [isAuthenticated, user, navigate, nextPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await api.post("/auth/login", { email, password });
      const { access_token, refresh_token } = response.data;

      login(access_token, refresh_token);

      // Decode locally to navigate immediately without waiting for context refresh cycle
      const decoded: any = jwtDecode(access_token);
      navigate(resolvePostLoginPath(decoded.rol, nextPath));

    } catch (err: any) {
      setError(err.response?.data?.detail || "Credenciales inválidas. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageTransition>
      <AuthSplitLayout
        heading="Bienvenido de vuelta"
        description="Ingresa tus credenciales para acceder al panel de monitoreo."
      >
        {error && (
          <div
            id="login-error"
            role="alert"
            aria-live="assertive"
            className="mb-6 rounded-[16px] border border-[var(--status-danger)]/25 bg-[var(--status-danger-bg)] p-4 text-center text-sm text-[var(--status-danger-text)]"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="login-email" className="mb-2 block text-sm font-medium text-[var(--text-body)]">
              Correo electrónico
            </label>
            <input
              id="login-email"
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.mx"
              autoComplete="email"
              className="w-full rounded-[24px] border border-[var(--border-strong)] bg-[var(--surface-card-primary)] px-5 py-3 text-[var(--text-body)] placeholder:text-[var(--text-subtle)]/70
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1"
              required
              disabled={isLoading}
              aria-invalid={!!error}
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>

          <div>
            <label htmlFor="login-password" className="mb-2 block text-sm font-medium text-[var(--text-body)]">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="login-password"
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full rounded-[24px] border border-[var(--border-strong)] bg-[var(--surface-card-primary)] px-5 py-3 pr-14 text-[var(--text-body)] placeholder:text-[var(--text-subtle)]/70
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1"
                required
                disabled={isLoading}
                aria-invalid={!!error}
                aria-describedby={error ? "login-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-subtle)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-body)]
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              to="/recuperar-contrasena"
              className="inline-flex min-h-[44px] items-center rounded-full px-3 text-sm text-[var(--text-subtle)] transition-colors hover:text-[var(--accent-primary)] focus:outline-none focus-visible:underline focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              ¿Olvidé mi contraseña?
            </Link>
          </div>

          <PillButton type="submit" variant="primary" className="w-full" disabled={isLoading} loading={isLoading}>
            {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </PillButton>
        </form>
      </AuthSplitLayout>
    </PageTransition>
  );
}

function resolvePostLoginPath(role: "admin" | "cliente", nextPath: string | null) {
  const defaultPath = role === "admin" ? "/admin" : "/cliente";
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return defaultPath;
  }
  if (role === "admin" && nextPath.startsWith("/admin")) {
    return nextPath;
  }
  if (role === "cliente" && nextPath.startsWith("/cliente")) {
    return nextPath;
  }
  return defaultPath;
}
