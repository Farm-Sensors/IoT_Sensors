import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";

import { Disclosure } from "../../components/Disclosure";
import { PageTransition } from "../../components/PageTransition";
import { useAlertPlaces } from "../../hooks/useAlertPlaces";
import { getAIReport } from "../../services/aiReports";
import { describePeriod, formatDateTime, REPORT_STATUS } from "./reportFormat";

const card = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 md:p-5";
const quietButton =
  "inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius)] border border-[var(--border-strong)] px-4 text-sm font-semibold text-[var(--text-body)] hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

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

/**
 * Reporte automático: el periodo y el lugar como título, el resumen primero, después hallazgos y recomendación.
 * Los datos de generación (fecha, metadatos, error) quedan plegados y solo para el administrador.
 */
export function AIReportDetailPage() {
  const { reportId } = useParams();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const reportsPath = isAdmin ? "/admin/reportes-ia" : "/cliente/reportes-ia";
  const parsedReportId = Number(reportId);
  const { placeOf, clients } = useAlertPlaces(isAdmin);

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
      setErrorMessage("No fue posible cargar el reporte");
    } finally {
      setLoading(false);
    }
  }, [parsedReportId]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const metadataText = useMemo(() => metadataToText(report?.generation_metadata ?? null), [report?.generation_metadata]);
  const meta = report ? REPORT_STATUS[report.status] : null;
  const where = report
    ? report.irrigation_area_id
      ? placeOf(report.irrigation_area_id).where
      : isAdmin
        ? `${clients.find((c) => c.id === report.client_id)?.name ?? "Cliente"} › todas las áreas`
        : "Todas tus áreas"
    : "";

  const sections: Array<[string, string | null | undefined, string]> = report
    ? [
        ["Resumen", report.summary, "Este reporte no trae resumen."],
        ["Hallazgos", report.findings, "No hay hallazgos en este reporte."],
        ["Recomendación", report.recommendation, "No hay recomendación en este reporte."],
      ]
    : [];

  return (
    <PageTransition>
      <div className="mx-auto max-w-[900px] p-4 md:p-8">
        <Link
          to={reportsPath}
          className="mb-3 inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-[var(--accent-primary)] hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Volver a reportes automáticos
        </Link>

        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-12 text-[var(--text-subtle)]">
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
            Cargando reporte…
          </div>
        ) : errorMessage && !report ? (
          <div role="alert" className="rounded-[var(--radius)] border border-[var(--status-danger-text)]/30 bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-text)]">
            {errorMessage}
          </div>
        ) : report && meta ? (
          <>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <span className={`mb-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.bg} ${meta.text}`}>
                  <meta.icon aria-hidden="true" className={`h-3.5 w-3.5 ${meta.spin ? "animate-spin" : ""}`} />
                  {meta.label}
                </span>
                <h1 className="text-2xl font-semibold text-[var(--text-title)] md:text-3xl">Reporte del {describePeriod(report.range_start, report.range_end)}</h1>
                <p className="mt-1 text-sm text-[var(--text-subtle)]">{where}</p>
              </div>
              <button type="button" onClick={() => void fetchReport()} className={quietButton}>
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Actualizar
              </button>
            </div>

            {meta.note && (
              <p role="status" className={`mb-4 rounded-[var(--radius)] px-3 py-2 text-sm ${meta.bg} ${meta.text}`}>{meta.note}</p>
            )}
            {report.status === "failed" && (
              <p role="alert" className="mb-4 rounded-[var(--radius)] bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-text)]">
                {report.error_detail?.trim() || "No se pudo generar este reporte."}
              </p>
            )}

            <div className="space-y-4">
              {sections.map(([title, text, empty]) => (
                <section key={title} aria-labelledby={`reporte-${title}`} className={card}>
                  <h2 id={`reporte-${title}`} className="mb-2 text-base font-semibold">{title}</h2>
                  {text?.trim() ? (
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--text-body)]">{text}</p>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">{empty}</p>
                  )}
                </section>
              ))}
            </div>

            {isAdmin && (
              <Disclosure summary="Datos de generación (soporte)" className="mt-4">
                <dl className="space-y-2">
                  <div>
                    <dt className="text-xs text-[var(--text-muted)]">Generado</dt>
                    <dd className="font-semibold">{formatDateTime(report.generated_at) ?? "Aún sin generar"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--text-muted)]">Error</dt>
                    <dd>{report.error_detail?.trim() || "Sin errores registrados"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--text-muted)]">Metadatos</dt>
                    <dd><pre className="whitespace-pre-wrap font-mono-data text-xs">{metadataText}</pre></dd>
                  </div>
                </dl>
              </Disclosure>
            )}
          </>
        ) : null}
      </div>
    </PageTransition>
  );
}
