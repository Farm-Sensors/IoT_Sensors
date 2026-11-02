import { format } from "date-fns";
import {
  ArrowLeft,
  Bot,
  CalendarRange,
  CircleAlert,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";

import { BentoCard } from "../../components/BentoCard";
import { PageTransition } from "../../components/PageTransition";
import { AIReportStatus, getAIReport } from "../../services/aiReports";

const statusStyles: Record<AIReportStatus, string> = {
  pending: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  processing: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  completed: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
  failed: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
};

const statusLabels: Record<AIReportStatus, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  completed: "Completado",
  failed: "Fallido",
};

function formatDateTime(isoValue: string | null): string {
  if (!isoValue) return "N/D";
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return isoValue;
  return format(parsed, "dd/MM/yyyy HH:mm");
}

function metadataToText(raw: string | null): string {
  if (!raw?.trim()) return "Sin metadatos";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(parsed)
      .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
      .join("\n");
  } catch {
    return raw;
  }
}

export function AIReportDetailPage() {
  const { reportId } = useParams();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const reportsPath = isAdmin ? "/admin/reportes-ia" : "/cliente/reportes-ia";
  const parsedReportId = Number(reportId);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [report, setReport] = useState<Awaited<ReturnType<typeof getAIReport>> | null>(null);

  const fetchReport = useCallback(async () => {
    if (!Number.isFinite(parsedReportId) || parsedReportId <= 0) {
      setErrorMessage("El reporte solicitado no es válido");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await getAIReport(parsedReportId);
      setReport(data);
    } catch (error) {
      console.error("Failed to fetch AI report detail", error);
      setErrorMessage("No fue posible cargar el reporte IA");
    } finally {
      setLoading(false);
    }
  }, [parsedReportId]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const metadataText = useMemo(
    () => metadataToText(report?.generation_metadata ?? null),
    [report?.generation_metadata],
  );

  return (
    <PageTransition>
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              to={reportsPath}
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-primary)] hover:opacity-80"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a reportes automáticos
            </Link>
            <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-title)]">
              Reporte automático
            </h1>
            <p className="text-[var(--text-subtle)]">
              Resumen operativo para seguimiento en plataforma.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              void fetchReport();
            }}
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
              Cargando reporte IA...
            </div>
          </BentoCard>
        ) : errorMessage && !report ? (
          <BentoCard variant="light">
            <div className="rounded-xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-text)]">
              {errorMessage}
            </div>
          </BentoCard>
        ) : report ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <BentoCard variant="light">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[report.status]}`}
                >
                  {statusLabels[report.status]}
                </span>
                <span className="rounded-full bg-[var(--surface-card-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--text-body)]">
                  Reporte #{report.id}
                </span>
                <span className="rounded-full bg-[var(--surface-card-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--text-body)]">
                  Cliente {report.client_id}
                </span>
              </div>

              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 text-sm text-[var(--text-subtle)]">
                  <CalendarRange className="h-4 w-4" />
                  {formatDateTime(report.range_start)} - {formatDateTime(report.range_end)}
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-subtle)]">
                    Resumen
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-body)] whitespace-pre-wrap">
                    {report.summary?.trim() || "Sin resumen disponible"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-subtle)]">
                    Hallazgos
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-body)] whitespace-pre-wrap">
                    {report.findings?.trim() || "Sin hallazgos disponibles"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-subtle)]">
                    Recomendación
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-body)] whitespace-pre-wrap">
                    {report.recommendation?.trim() || "Sin recomendación disponible"}
                  </p>
                </div>
              </div>
            </BentoCard>

            <BentoCard variant="light">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent-gold-glow)] text-[var(--accent-primary)]">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-title)]">
                    Trazabilidad de generación
                  </h2>
                  <p className="text-sm text-[var(--text-subtle)]">
                    Datos técnicos para auditoría y soporte.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-3">
                  <p className="text-xs text-[var(--text-subtle)]">Generado en</p>
                  <p className="text-sm font-semibold text-[var(--text-body)]">
                    {formatDateTime(report.generated_at)}
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-3">
                  <p className="text-xs text-[var(--text-subtle)]">Error</p>
                  <p className="text-sm text-[var(--text-body)]">
                    {report.error_detail?.trim() || "Sin errores registrados"}
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-3">
                  <p className="mb-2 text-xs text-[var(--text-subtle)]">Metadatos</p>
                  <pre className="whitespace-pre-wrap text-xs text-[var(--text-body)]">{metadataText}</pre>
                </div>
              </div>

              {report.status !== "completed" && (
                <p className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning-text)]">
                  <CircleAlert className="h-4 w-4" />
                  Este reporte no está completado aún. Vuelve a consultar en unos minutos.
                </p>
              )}
            </BentoCard>
          </div>
        ) : null}
      </div>
    </PageTransition>
  );
}
