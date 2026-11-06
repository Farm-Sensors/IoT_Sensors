import { useEffect, useState } from "react";
import { ErrorState } from "../../components/ErrorState";
import { PageHeader } from "../../components/PageHeader";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { SkeletonCard } from "../../components/SkeletonCard";
import { useToast } from "../../components/Toast";
import { api } from "../../services/api";
import { FocusBlock } from "../../components/FocusBlock";
import { UserProfile } from "../../types/api";

const inputClass = `
  min-h-[44px] w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--bg-base)] px-3 py-2
  text-[var(--text-main)]
  focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1
  disabled:opacity-60 disabled:cursor-default
`;
const panel = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 md:p-6";

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ProfilePage() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState("");

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<UserProfile>("/users/me");
      setProfile(res.data);
      setFormName(res.data.full_name);
    } catch (err: any) {
      setError(err.response?.data?.detail || "No fue posible cargar el perfil.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.patch<UserProfile>("/users/me", {
        full_name: formName,
      });
      setProfile(res.data);
      setFormName(res.data.full_name);
      setIsEditing(false);
      showToast("Perfil actualizado correctamente.", "success");
    } catch (err: any) {
      setError(err.response?.data?.detail || "No fue posible guardar el perfil.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
          <SkeletonCard lines={3} />
        </div>
      </PageTransition>
    );
  }

  if (!profile && error) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
          <PageHeader title="Cuenta" />
          <div className={panel}><ErrorState message={error} onRetry={loadProfile} /></div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
        <PageHeader
          title="Cuenta"
          subtitle="Tu información personal"
          action={
            profile && (
              <PillButton
                variant={isEditing ? "primary" : "secondary"}
                disabled={saving}
                onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
              >
                {saving ? "Guardando..." : isEditing ? "Guardar Cambios" : "Editar Perfil"}
              </PillButton>
            )
          }
        />
        {profile && <FocusBlock value="Productor" label="tu cuenta" hint={`${profile.full_name} · ${profile.email}`} />}

        {error && (
          <div role="alert" className="rounded-[var(--radius)] border border-[var(--status-danger)]/25 bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger-text)]">
            {error}
          </div>
        )}

        <section aria-labelledby="perfil-h" className={panel}>
          <h2 id="perfil-h" className="mb-4 text-lg font-semibold">Perfil</h2>
          {profile && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="profile-name" className="mb-1 block text-sm text-[var(--text-muted)]">Nombre Completo</label>
                <input id="profile-name" type="text" value={formName} onChange={(e) => setFormName(e.target.value)} disabled={!isEditing} className={inputClass} />
              </div>
              <div>
                <label htmlFor="profile-email" className="mb-1 block text-sm text-[var(--text-muted)]">Correo Electrónico</label>
                <input id="profile-email" type="email" value={profile.email} disabled readOnly className={inputClass} />
              </div>
              <p className="text-sm text-[var(--text-muted)] md:col-span-2">
                Última actualización: {formatUpdatedAt(profile.updated_at)}
              </p>
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
