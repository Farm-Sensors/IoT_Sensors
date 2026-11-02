import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { AuthSplitLayout } from "../../components/auth/AuthSplitLayout";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { api } from "../../services/api";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDetail("");

    if (!token) {
      setError("El token de recuperacion no esta presente en el enlace.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contrasenas no coinciden.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post("/auth/reset-password", {
        token,
        new_password: newPassword,
      });
      setDetail(response.data?.detail || "Contrasena actualizada exitosamente.");
      setTimeout(() => navigate("/"), 1200);
    } catch (err: any) {
      setError(err.response?.data?.detail || "No se pudo actualizar la contrasena");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageTransition>
      <AuthSplitLayout
        heading="Restablecer contraseña"
        description="Define una nueva contraseña para recuperar el acceso a tu panel."
        footer={
          <div className="text-center">
            <Link
              to="/"
              className="text-sm text-[var(--text-subtle)] transition-colors hover:text-[var(--accent-primary)]"
            >
              Volver a inicio de sesión
            </Link>
          </div>
        }
      >
        {error && (
          <div className="mb-6 rounded-[var(--radius)] border border-[#DC2626]/25 bg-[#DC2626]/10 p-4 text-center text-sm text-[#DC2626]">
            {error}
          </div>
        )}

        {detail && (
          <div className="mb-6 rounded-[var(--radius)] border border-[var(--status-active)]/25 bg-[var(--status-active)]/10 p-4 text-center text-sm text-[var(--status-active-text)]">
            {detail}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-subtle)]">
              Nueva contraseña
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-card-primary)] px-5 py-3 text-[var(--text-body)] placeholder:text-[var(--text-subtle)]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1"
              minLength={8}
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-subtle)]">
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite tu nueva contraseña"
              className="w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-card-primary)] px-5 py-3 text-[var(--text-body)] placeholder:text-[var(--text-subtle)]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1"
              minLength={8}
              required
              disabled={isLoading}
            />
          </div>

          <PillButton type="submit" variant="primary" className="w-full" disabled={isLoading} loading={isLoading}>
            {isLoading ? "Actualizando..." : "Actualizar contraseña"}
          </PillButton>
        </form>
      </AuthSplitLayout>
    </PageTransition>
  );
}
