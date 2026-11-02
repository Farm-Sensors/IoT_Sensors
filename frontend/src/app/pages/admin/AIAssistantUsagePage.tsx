import { Activity, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BentoCard } from "../../components/BentoCard";
import { PageTransition } from "../../components/PageTransition";
import {
  AIAssistantUsageItem,
  getAIAssistantUsage,
} from "../../services/aiAssistantUsage";

const PAGE_SIZE = 20;

function formatDateTime(value?: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AIAssistantUsagePage() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<AIAssistantUsageItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hours, setHours] = useState(24);
  const [action, setAction] = useState("");
  const [userId, setUserId] = useState("");
  const [summary, setSummary] = useState({
    total_requests: 0,
    successful_requests: 0,
    ai_responses: 0,
    fallback_responses: 0,
    error_requests: 0,
    rate_limited_requests: 0,
    total_prompt_tokens: 0,
    total_completion_tokens: 0,
    avg_latency_ms: null as number | null,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchUsage = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await getAIAssistantUsage({
        page,
        per_page: PAGE_SIZE,
        hours,
        action: action || undefined,
        user_id: userId ? Number(userId) : undefined,
      });
      setItems(response.data ?? []);
      setSummary(response.summary);
      setTotal(response.total ?? 0);
    } catch (error) {
      console.error("Failed to fetch AI assistant usage", error);
      setErrorMessage("No fue posible cargar el consumo del asistente IA.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsage();
  }, [page, hours, action, userId]);

  const successRatio = useMemo(() => {
    if (summary.total_requests <= 0) return "0%";
    return `${Math.round((summary.successful_requests / summary.total_requests) * 100)}%`;
  }, [summary.total_requests, summary.successful_requests]);

  return (
    <PageTransition>
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-title)]">
              Consumo IA
            </h1>
            <p className="text-[var(--text-subtle)]">
              Trazabilidad operativa del asistente conversacional.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void fetchUsage()}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-4 py-2 text-sm font-medium text-[var(--text-body)] hover:bg-[var(--hover-overlay)]"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>

        <BentoCard variant="light" className="mb-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
              Ventana
              <select
                value={hours}
                onChange={(event) => {
                  setHours(Number(event.target.value));
                  setPage(1);
                }}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2 text-[var(--text-body)]"
              >
                <option value={24}>24 horas</option>
                <option value={72}>72 horas</option>
                <option value={168}>7 días</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
              Acción
              <select
                value={action}
                onChange={(event) => {
                  setAction(event.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2 text-[var(--text-body)]"
              >
                <option value="">Todas</option>
                <option value="execute">execute</option>
                <option value="error">error</option>
                <option value="rate_limited">rate_limited</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--text-subtle)]">
              Usuario ID
              <input
                type="number"
                min={1}
                placeholder="Todos"
                value={userId}
                onChange={(event) => {
                  setUserId(event.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2 text-[var(--text-body)]"
              />
            </label>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2">
              <div className="text-xs text-[var(--text-subtle)]">Solicitudes</div>
              <div className="text-base font-semibold text-[var(--text-body)]">
                {summary.total_requests}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2">
              <div className="text-xs text-[var(--text-subtle)]">Éxito</div>
              <div className="text-base font-semibold text-[var(--text-body)]">
                {successRatio}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2">
              <div className="text-xs text-[var(--text-subtle)]">Latencia promedio</div>
              <div className="text-base font-semibold text-[var(--text-body)]">
                {summary.avg_latency_ms != null ? `${summary.avg_latency_ms} ms` : "-"}
              </div>
            </div>
          </div>
        </BentoCard>

        <BentoCard variant="light">
          <div className="mb-4 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-sm text-[var(--text-subtle)]">
              <Activity className="h-4 w-4" />
              in={summary.total_prompt_tokens} · out={summary.total_completion_tokens} · ai={summary.ai_responses} · fallback={summary.fallback_responses}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                disabled={page <= 1}
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-2 text-[var(--text-body)] disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-[var(--text-subtle)]">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
                disabled={page >= totalPages}
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-2 text-[var(--text-body)] disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-[var(--text-subtle)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando consumo IA...
            </div>
          ) : errorMessage ? (
            <div className="rounded-xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-text)]">
              {errorMessage}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-6 text-center text-sm text-[var(--text-subtle)]">
              Sin registros para los filtros seleccionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    <th className="px-2 py-2 text-xs text-[var(--text-subtle)]">Fecha</th>
                    <th className="px-2 py-2 text-xs text-[var(--text-subtle)]">Usuario</th>
                    <th className="px-2 py-2 text-xs text-[var(--text-subtle)]">Acción</th>
                    <th className="px-2 py-2 text-xs text-[var(--text-subtle)]">Fuente</th>
                    <th className="px-2 py-2 text-xs text-[var(--text-subtle)]">Modelo</th>
                    <th className="px-2 py-2 text-xs text-[var(--text-subtle)]">Tokens</th>
                    <th className="px-2 py-2 text-xs text-[var(--text-subtle)]">Latencia</th>
                    <th className="px-2 py-2 text-xs text-[var(--text-subtle)]">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr
                      key={item.id}
                      className={index % 2 === 0 ? "bg-[var(--surface-card-primary)]/50" : ""}
                    >
                      <td className="px-2 py-2 text-sm text-[var(--text-body)]">
                        {formatDateTime(item.created_at)}
                      </td>
                      <td className="px-2 py-2 text-sm text-[var(--text-body)]">
                        {item.user_name || item.user_email || "Sistema"}
                      </td>
                      <td className="px-2 py-2 text-sm text-[var(--text-body)]">{item.action}</td>
                      <td className="px-2 py-2 text-sm text-[var(--text-body)]">
                        {item.source || "-"}
                      </td>
                      <td className="px-2 py-2 text-sm text-[var(--text-body)]">
                        {item.model || item.provider || "-"}
                      </td>
                      <td className="px-2 py-2 text-sm text-[var(--text-body)]">
                        {item.tokens_prompt ?? 0}/{item.tokens_completion ?? 0}
                      </td>
                      <td className="px-2 py-2 text-sm text-[var(--text-body)]">
                        {item.latency_ms != null ? `${item.latency_ms} ms` : "-"}
                      </td>
                      <td className="px-2 py-2 text-sm text-[var(--text-body)]">
                        {item.status_code ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </BentoCard>
      </div>
    </PageTransition>
  );
}
