import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { BentoCard } from "../../components/BentoCard";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { useToast } from "../../components/Toast";
import { api } from "../../services/api";
import { getErrorMessage } from "../../utils/errors";
import {
  DASHBOARD_CARD_KEYS,
  DASHBOARD_CARD_LABELS,
  getClientDashboardPreferences,
  updateClientDashboardPreferences,
  type DashboardCardKey,
} from "../../services/dashboardPreferences";

export function DashboardPreferences() {
  const { clientId } = useParams<{ clientId: string }>();
  const { showToast } = useToast();
  const [clientName, setClientName] = useState("Cargando...");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [selected, setSelected] = useState<Set<DashboardCardKey>>(new Set());

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [clientRes, preferences] = await Promise.all([
          api.get(`/clients/${clientId}`),
          getClientDashboardPreferences(Number(clientId)),
        ]);
        if (cancelled) return;
        setClientName(clientRes.data.company_name);
        setConfigured(preferences.cards !== null);
        setSelected(new Set(preferences.cards ?? []));
      } catch (err) {
        if (cancelled) return;
        setClientName("Desconocido");
        showToast(
          getErrorMessage(err, "No se pudieron cargar las preferencias del dashboard"),
          "error",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchData();
    return () => {
      cancelled = true;
    };
  }, [clientId, showToast]);

  const toggleCard = (key: DashboardCardKey) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!clientId) return;
    setSaving(true);
    try {
      const preferences = await updateClientDashboardPreferences(
        Number(clientId),
        Array.from(selected),
      );
      setConfigured(preferences.cards !== null);
      setSelected(new Set(preferences.cards ?? []));
      showToast("Preferencias del dashboard guardadas", "success");
    } catch (err) {
      showToast(
        getErrorMessage(err, "Error al guardar las preferencias del dashboard"),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!clientId) return;
    setSaving(true);
    try {
      const preferences = await updateClientDashboardPreferences(Number(clientId), null);
      setConfigured(preferences.cards !== null);
      setSelected(new Set(preferences.cards ?? []));
      showToast("Dashboard vuelto al modo automático", "success");
    } catch (err) {
      showToast(
        getErrorMessage(err, "Error al volver al modo automático"),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-[var(--text-subtle)] mb-2">
            <Link to="/admin/clientes" className="hover:text-[var(--accent-primary)] transition-colors">Clientes</Link>
            <span>/</span>
            <span>{clientName}</span>
            <span>/</span>
            <span>Dashboard</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-title)] mb-2">
            Tarjetas del dashboard
          </h1>
          <p className="text-[var(--text-subtle)]">
            Elige qué tarjetas ve <span className="text-[var(--text-main)]">{clientName}</span> en su dashboard.
          </p>
        </div>

        <div
          role="note"
          className="mb-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-4 py-3 text-sm text-[var(--text-subtle)]"
        >
          {configured
            ? "Configurado: el dashboard muestra exactamente las tarjetas marcadas."
            : "Sin configurar: el dashboard muestra automáticamente solo las tarjetas que tengan datos en la última lectura."}
        </div>

        <BentoCard variant="light" className="max-w-3xl">
          {loading ? (
            <p className="text-[var(--text-subtle)]">Cargando preferencias...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {DASHBOARD_CARD_KEYS.map((key) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-4 py-3 cursor-pointer hover:bg-[var(--hover-overlay)] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(key)}
                      onChange={() => toggleCard(key)}
                      className="h-4 w-4 shrink-0 accent-[var(--accent-primary)]"
                    />
                    <span className="text-[var(--text-body)]">{DASHBOARD_CARD_LABELS[key]}</span>
                  </label>
                ))}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <PillButton variant="outline" onClick={handleReset} loading={saving} disabled={loading || !configured}>
                  Volver a automático
                </PillButton>
                <PillButton variant="primary" onClick={handleSave} loading={saving} disabled={loading}>
                  Guardar preferencias
                </PillButton>
              </div>
            </>
          )}
        </BentoCard>
      </div>
    </PageTransition>
  );
}
