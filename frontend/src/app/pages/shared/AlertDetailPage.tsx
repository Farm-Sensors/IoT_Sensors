import { format, formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";

import { PageTransition } from "../../components/PageTransition";
import { useAlertPlaces } from "../../hooks/useAlertPlaces";
import { useModuleStatus } from "../../hooks/useModules";
import {
  AlertItem,
  generateAlertRecommendation,
  getAlert,
  markAlertRead,
} from "../../services/alerts";
import { parseBackendTimestamp } from "../../utils/datetime";
import { formatValue, parameterLabel, SEVERITY_META, TYPE_LABEL } from "./alertFormat";

const card = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 md:p-5";
const quietButton =
  "inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius)] border border-[var(--border-strong)] px-4 text-sm font-semibold text-[var(--text-body)] hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";

function formatTimestamp(iso: string): string {
  const parsed = parseBackendTimestamp(iso);
  if (!parsed) return iso;
  return `${format(parsed, "dd/MM/yyyy HH:mm")} (${formatDistanceToNowStrict(parsed, {
    addSuffix: true,
    locale: es,
  })})`;
}

/** Título honesto según de dónde sale la sugerencia. */
function recommendationTitle(source: string | null): string {
  if (source === "ai" || source === "cached_ai") return "Sugerencia automática";
  if (source === "fallback" || source === "cached_fallback") return "Sugerencia basada en reglas";
  return "Sugerencia";
}

export function AlertDetailPage() {
  const { alertId } = useParams();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const alertsPath = isAdmin ? "/admin/alertas" : "/cliente/alertas";
  const thresholdsPath = isAdmin ? "/admin/umbrales" : "/cliente/umbrales";
  const { placeOf } = useAlertPlaces(isAdmin);
  const parsedAlertId = Number(alertId);
  // Con el módulo de alertas apagado basta el aviso «Desactivado»: no se pide la alerta ni se muestra un error.
  const modules = useModuleStatus();
  const alertsOn = modules?.alerts === true;

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
    if (modules === null) return;
    if (!alertsOn) { setLoading(false); return; }
    fetchAlert();
  }, [fetchAlert, modules, alertsOn]);

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

  const meta = alert ? SEVERITY_META[alert.severity] : null;
  const place = alert ? placeOf(alert.irrigation_area_id) : null;
  const measurement = alert ? parameterLabel(alert.parameter) : null;
  const value = alert ? formatValue(alert) : null;
  const areaPath = alert ? (isAdmin ? `/admin/areas/${alert.irrigation_area_id}` : `/cliente/area/${alert.irrigation_area_id}`) : "";
  const notified = alert ? [alert.notified_email && "correo", alert.notified_whatsapp && "WhatsApp"].filter(Boolean) : [];

  return (
    <PageTransition>
      <div className="mx-auto max-w-[1100px] p-4 md:p-8">
        <Link
          to={alertsPath}
          className="mb-3 inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-[var(--accent-primary)] hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {isAdmin ? "Volver a todas las alertas" : "Volver a mis alertas"}
        </Link>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[var(--text-subtle)]" role="status">
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
            Cargando alerta…
          </div>
        ) : errorMessage && !alert ? (
          <div role="alert" className="rounded-[var(--radius)] border border-[var(--status-danger-text)]/30 bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-text)]">
            {errorMessage}
          </div>
        ) : alert && meta && place ? (
          <>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${meta.bg} ${meta.text}`}>
                    <meta.icon aria-hidden="true" className="h-3.5 w-3.5" />
                    {meta.label}
                  </span>
                  <span className="text-[var(--text-muted)]">{TYPE_LABEL[alert.type]}</span>
                  <span className={`font-semibold ${alert.read ? "text-[var(--text-muted)]" : "text-[var(--text-main)]"}`}>{alert.read ? "Leída" : "Sin leer"}</span>
                </div>
                <h1 className="text-2xl font-semibold text-[var(--text-title)] md:text-3xl">{alert.message}</h1>
                <p className="mt-1 text-sm text-[var(--text-subtle)]">{place.where}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!alert.read && (
                  <button type="button" onClick={markAsRead} disabled={updating} className={quietButton}>
                    {updating ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
                    Marcar como leída
                  </button>
                )}
                <button type="button" onClick={fetchAlert} className={quietButton}>
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  Actualizar
                </button>
              </div>
            </div>
            {errorMessage && (
              <p role="alert" className="mb-4 rounded-[var(--radius)] border border-[var(--status-danger-text)]/30 bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-text)]">{errorMessage}</p>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <section aria-labelledby="alerta-datos" className={card}>
                <h2 id="alerta-datos" className="mb-2 text-base font-semibold">Qué pasó</h2>
                <dl>
                  {[
                    measurement ? ["Medición", measurement] : null,
                    value ? ["Valor detectado", value] : null,
                    ["Cuándo", formatTimestamp(alert.timestamp)],
                    ["Nodo", `Nodo ${alert.node_id}`],
                    ["Aviso enviado", notified.length > 0 ? `Por ${notified.join(" y ")}` : "No se envió por correo ni WhatsApp"],
                  ].filter((row): row is string[] => row !== null).map(([label, text]) => (
                    <div key={label} className="border-b border-[var(--border)] py-2.5 last:border-b-0">
                      <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
                      <dd className={`mt-0.5 text-base font-semibold ${label === "Valor detectado" ? "font-mono-data" : ""}`}>{text}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={areaPath} className={quietButton}>Ver el área</Link>
                  {alert.type === "threshold" && (
                    <Link to={`${thresholdsPath}?area=${alert.irrigation_area_id}`} className={quietButton}>Ver los umbrales del área</Link>
                  )}
                </div>
              </section>

              <section aria-labelledby="alerta-sugerencia" className={card}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 id="alerta-sugerencia" className="text-base font-semibold">{recommendationTitle(recommendationSource)}</h2>
                    <p className="text-sm text-[var(--text-muted)]">Una idea de qué revisar; no sustituye tu criterio.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void fetchRecommendation(true);
                    }}
                    disabled={recommendationLoading}
                    className={quietButton}
                  >
                    {recommendationLoading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden="true" className="h-4 w-4" />}
                    Regenerar
                  </button>
                </div>

                {recommendationLoading ? (
                  <div role="status" className="flex items-center gap-2 rounded-[var(--radius)] bg-[var(--surface-panel)] p-3 text-sm text-[var(--text-subtle)]">
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    Generando sugerencia…
                  </div>
                ) : recommendationText ? (
                  <div className="space-y-2">
                    <p className="whitespace-pre-wrap rounded-[var(--radius)] bg-[var(--surface-panel)] p-3 text-sm text-[var(--text-body)]">{recommendationText}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Generada: {recommendationGeneratedAt ? formatTimestamp(recommendationGeneratedAt) : "sin fecha"}
                    </p>
                  </div>
                ) : (
                  <p className="rounded-[var(--radius)] bg-[var(--surface-panel)] p-3 text-sm text-[var(--text-subtle)]">Aún no hay sugerencia para esta alerta.</p>
                )}

                {recommendationError && (
                  <p className="mt-3 rounded-[var(--radius)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning-text)]">{recommendationError}</p>
                )}
              </section>
            </div>
          </>
        ) : null}
      </div>
    </PageTransition>
  );
}
