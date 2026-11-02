import { useState } from "react";
import { Link } from "react-router";
import { AuthSplitLayout } from "../../components/auth/AuthSplitLayout";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { api } from "../../services/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setDetail("");

    try {
      const response = await api.post("/auth/forgot-password", { email });
      setDetail(response.data?.detail || "Si el correo existe, se envió el enlace de recuperación.");
    } catch (err: any) {
      setError(err.response?.data?.detail || "No se pudo procesar la solicitud.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageTransition>
      <AuthSplitLayout
        heading="Recuperar contraseña"
        description="Ingresa tu correo y te enviaremos un enlace para restablecer el acceso."
        footer={
          <div className="text-center">
            <Link
              to="/"
              className="text-sm text-[var(--text-subtle)] transition-colors hover:text-[var(--accent-primary)] focus:outline-none focus-visible:underline"
            >
              ← Volver a inicio de sesión
            </Link>
          </div>
        }
      >
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-6 rounded-[var(--radius)] border border-[#DC2626]/25 bg-[#DC2626]/10 p-4 text-center text-sm text-[#DC2626]"
          >
            {error}
          </div>
        )}

        {detail && (
          <div
            role="status"
            aria-live="polite"
            className="mb-6 rounded-[var(--radius)] border border-[var(--accent-primary)]/25 bg-[var(--accent-primary)]/10 p-4 text-center text-sm text-[var(--accent-primary)]"
          >
            {detail}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="forgot-email" className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-subtle)]">
              Correo electrónico
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.mx"
              autoComplete="email"
              className="w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-card-primary)] px-5 py-3 text-[var(--text-body)] placeholder:text-[var(--text-subtle)]/70
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1"
              required
              disabled={isLoading}
            />
          </div>

          <PillButton type="submit" variant="primary" className="w-full" disabled={isLoading} loading={isLoading}>
            {isLoading ? "Enviando..." : "Enviar enlace"}
          </PillButton>
        </form>
      </AuthSplitLayout>
    </PageTransition>
  );
}
