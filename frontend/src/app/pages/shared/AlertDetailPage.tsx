import { format, formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  Bell,
  Bot,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";

import { BentoCard } from "../../components/BentoCard";
import { PageTransition } from "../../components/PageTransition";
import {
  AlertItem,
  generateAlertRecommendation,
  getAlert,
  markAlertRead,
} from "../../services/alerts";

const severityStyles: Record<AlertItem["severity"], string> = {
  info: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  critical: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
};

const typeLabels: Record<AlertItem["type"], string> = {
  threshold: "Umbral",
  inactivity: "Inactividad",
};

function formatTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return `${format(parsed, "dd/MM/yyyy HH:mm")} (${formatDistanceToNowStrict(parsed, {
    addSuffix: true,
    locale: es,
  })})`;
}

function recommendationSourceLabel(source: string | null): string {
  if (source === "ai" || source === "cached_ai") return "IA";
  if (source === "fallback" || source === "cached_fallback") return "Reglas";
  return "N/D";
}

export function AlertDetailPage() {
  const { alertId } = useParams();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const alertsPath = isAdmin ? "/admin/alertas" : "/cliente/alertas";
  const parsedAlertId = Number(alertId);

  const [alert, setAlert] = useState<AlertItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationText, setRecommendationText] = useState<string>("");
  const [recommendationSource, setRecommendationSource] = useState<string | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [recommendationGeneratedAt, setRecommendationGeneratedAt] = useState<string | null>(null);

  const syncRecommendationFromAlert = useCallback((item: AlertItem) => {
    setRecommendationText(item.ai_recommendation ?? "");
    setRecommendationError(item.ai_recommendation_error);
    setRecommendationGeneratedAt(item.ai_recommendation_generated_at);

    if (item.ai_recommendation) {
      try {
        const metadata = item.ai_recommendation_metadata
          ? JSON.parse(item.ai_recommendation_metadata)
          : null;
        if (metadata?.provider === "rules-fallback") {
          setRecommendationSource("cached_fallback");
        } else {
          setRecommendationSource("cached_ai");
        }
      } catch {
        setRecommendationSource("cached_ai");
      }
    } else {
      setRecommendationSource(null);
    }
  }, []);

  const fetchAlert = useCallback(async () => {
    if (!Number.isFinite(parsedAlertId) || parsedAlertId <= 0) {
      setErrorMessage("La alerta solicitada no es válida");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await getAlert(parsedAlertId);
      setAlert(data);
      syncRecommendationFromAlert(data);
    } catch (error) {
      console.error("Failed to fetch alert detail", error);
      setErrorMessage("No fue posible cargar la alerta");
    } finally {
      setLoading(false);
    }
  }, [parsedAlertId, syncRecommendationFromAlert]);

  const fetchRecommendation = useCallback(
    async (force = false) => {
      if (!alert) return;
      setRecommendationLoading(true);
      setRecommendationError(null);
      try {
        const result = await generateAlertRecommendation(alert.id, force);
        setRecommendationText(result.recommendation ?? "");
        setRecommendationSource(result.source);
        setRecommendationGeneratedAt(result.generated_at);
        setRecommendationError(result.error_detail);
      } catch (error) {
        console.error("Failed to fetch AI recommendation", error);
        setRecommendationError("No fue posible generar la recomendación IA.");
      } finally {
        setRecommendationLoading(false);
      }
    },
    [alert],
  );

  useEffect(() => {
    fetchAlert();
  }, [fetchAlert]);

  useEffect(() => {
    if (!alert) return;
    if (alert.ai_recommendation) return;
    void fetchRecommendation(false);
  }, [alert, fetchRecommendation]);

  const markAsRead = async () => {
    if (!alert || alert.read) return;
    setUpdating(true);
    setErrorMessage(null);
    try {
      const updated = await markAlertRead(alert.id, true);
      setAlert(updated);
      syncRecommendationFromAlert(updated);
    } catch (error) {
      console.error("Failed to mark alert as read", error);
      setErrorMessage("No fue posible marcar la alerta como leída");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              to={alertsPath}
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-primary)] hover:opacity-80"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a alertas
            </Link>
            <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-title)]">
              Recomendación de alerta
            </h1>
            <p className="text-[var(--text-subtle)]">
              Detalle operativo con recomendación generada por IA.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchAlert}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-4 py-2 text-sm font-medium text-[var(--text-body)] hover:bg-[var(--hover-overlay)]"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>

        {loading ? (
          <BentoCard variant="light">
            <div className="flex items-center justify-center gap-2 py-12 text-[var(--text-subtle)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando alerta...
            </div>
          </BentoCard>
        ) : errorMessage && !alert ? (
          <BentoCard variant="light">
            <div className="rounded-xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-text)]">
              {errorMessage}
            </div>
          </BentoCard>
        ) : alert ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <BentoCard variant="light">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${severityStyles[alert.severity]}`}
                >
                  {alert.severity.toUpperCase()}
                </span>
                <span className="rounded-full bg-[var(--surface-card-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--text-body)]">
                  {typeLabels[alert.type]}
                </span>
                {!alert.read && (
                  <span className="rounded-full bg-[var(--status-warning-bg)] px-2.5 py-1 text-xs font-medium text-[var(--status-warning-text)]">
                    No leída
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-subtle)]">
                    Mensaje
                  </p>
                  <p className="mt-1 text-base font-medium text-[var(--text-body)]">
                    {alert.message}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-3">
                    <p className="text-xs text-[var(--text-subtle)]">Nodo</p>
                    <p className="text-sm font-semibold text-[var(--text-body)]">
                      {alert.node_id}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-3">
                    <p className="text-xs text-[var(--text-subtle)]">Área</p>
                    <p className="text-sm font-semibold text-[var(--text-body)]">
                      {alert.irrigation_area_id}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-3">
                    <p className="text-xs text-[var(--text-subtle)]">Parámetro</p>
                    <p className="text-sm font-semibold text-[var(--text-body)]">
                      {alert.parameter ?? "N/D"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-3">
                    <p className="text-xs text-[var(--text-subtle)]">Valor detectado</p>
                    <p className="text-sm font-semibold text-[var(--text-body)]">
                      {alert.detected_value ?? "N/D"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--text-subtle)]">
                  <span className="inline-flex items-center gap-1">
                    <Bell className="h-4 w-4" />
                    {formatTimestamp(alert.timestamp)}
                  </span>
                  {alert.notified_email && <span>Correo enviado</span>}
                  {alert.notified_whatsapp && <span>WhatsApp enviado</span>}
                </div>

                {!alert.read && (
                  <button
                    type="button"
                    onClick={markAsRead}
                    disabled={updating}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-4 py-2 text-sm font-medium text-[var(--text-body)] hover:bg-[var(--hover-overlay)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Marcar como leída
                  </button>
                )}
              </div>
            </BentoCard>

            <BentoCard variant="light">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent-gold-glow)] text-[var(--accent-primary)]">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-title)]">
                      Recomendación IA
                    </h2>
                    <p className="text-sm text-[var(--text-subtle)]">
                      Fuente: {recommendationSourceLabel(recommendationSource)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void fetchRecommendation(true);
                  }}
                  disabled={recommendationLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-body)] hover:bg-[var(--hover-overlay)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {recommendationLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Regenerar
                </button>
              </div>

              {recommendationLoading ? (
                <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-3 text-sm text-[var(--text-subtle)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generando recomendación...
                </div>
              ) : recommendationText ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-3">
                    <p className="text-sm text-[var(--text-body)] whitespace-pre-wrap">
                      {recommendationText}
                    </p>
                  </div>

                  <div className="text-xs text-[var(--text-subtle)]">
                    Generada: {recommendationGeneratedAt ? formatTimestamp(recommendationGeneratedAt) : "N/D"}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-3 text-sm text-[var(--text-subtle)]">
                  Sin recomendación generada aún.
                </div>
              )}

              {recommendationError && (
                <p className="mt-4 rounded-xl border border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning-text)]">
                  {recommendationError}
                </p>
              )}
            </BentoCard>
          </div>
        ) : null}
      </div>
    </PageTransition>
  );
}
