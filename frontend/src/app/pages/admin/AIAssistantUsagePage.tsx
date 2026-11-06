import { format } from "date-fns";
import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Disclosure } from "../../components/Disclosure";
import { PageTransition } from "../../components/PageTransition";
import { useModuleStatus } from "../../hooks/useModules";
import { api } from "../../services/api";
import { AIAssistantUsageItem, getAIAssistantUsage } from "../../services/aiAssistantUsage";
import { parseBackendTimestamp } from "../../utils/datetime";

const PAGE_SIZE = 20;

const control =
  "min-h-[44px] rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-panel)] px-3 text-sm text-[var(--text-body)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";
const quietButton =
  "inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius)] border border-[var(--border-strong)] px-3 text-sm font-semibold text-[var(--text-body)] hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50";

const WINDOWS: Array<[number, string]> = [[24, "Últimas 24 horas"], [72, "Últimas 72 horas"], [168, "Últimos 7 días"]];

/** Cada acción registrada por el servidor, en palabras. */
const ACTION_LABEL: Record<string, string> = {
  execute: "Pregunta respondida",
  error: "Con error",
  rate_limited: "Límite excedido",
};

const SOURCE_LABEL: Record<string, string> = { ai: "IA", fallback: "Reglas" };

function formatDateTime(value?: string | null): string {
  const parsed = parseBackendTimestamp(value ?? null);
  return parsed ? format(parsed, "dd/MM/yyyy HH:mm") : "—";
}

const number = (n: number) => n.toLocaleString("es-MX");

function Stat({ label, value, hint, strong = false }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className={`rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-3 ${strong ? "focus-block" : ""}`}>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="font-mono-data text-xl font-medium text-[var(--text-main)]">{value}</p>
      {hint && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}

/**
 * Consumo del asistente (admin): cuánto se usa, con qué resultado y cuánto cuesta en tokens. Las cifras
 * del periodo van arriba; el registro de solicitudes, debajo, con usuario por nombre y acciones en palabras.
 */
export function AIAssistantUsagePage() {
  // Con el módulo apagado (o aún sin saberlo) no se pide nada: el servidor respondería 503.
  const enabled = useModuleStatus()?.ai_assistant === true;
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<AIAssistantUsageItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hours, setHours] = useState(24);
  const [action, setAction] = useState("");
  const [userId, setUserId] = useState(0);
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
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
  const hasFilters = Boolean(action || userId);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/users", { params: { per_page: 200 } })
      .then((response) => {
        if (cancelled) return;
        const list: Array<{ id: number; full_name: string; email: string }> = response.data?.data ?? [];
        setUsers(list.map((u) => ({ id: u.id, name: u.full_name || u.email })).sort((a, b) => a.name.localeCompare(b.name, "es")));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchUsage = async () => {
    if (!enabled) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await getAIAssistantUsage({
        page,
        per_page: PAGE_SIZE,
        hours,
        action: action || undefined,
        user_id: userId || undefined,
      });
      setItems(response.data ?? []);
      setSummary(response.summary);
      setTotal(response.total ?? 0);
      setUpdatedAt(new Date());
    } catch (error) {
      console.error("Failed to fetch AI assistant usage", error);
      setErrorMessage("No fue posible cargar el consumo del asistente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, hours, action, userId, enabled]);

  const successRatio = useMemo(() => {
    if (summary.total_requests <= 0) return "—";
    return `${Math.round((summary.successful_requests / summary.total_requests) * 100)} %`;
  }, [summary.total_requests, summary.successful_requests]);

  const problems = summary.error_requests + summary.rate_limited_requests;

  return (
    <PageTransition>
      <div className="mx-auto max-w-[1100px] p-4 md:p-8">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-title)] md:text-3xl">Consumo del asistente</h1>
            <p className="mt-1 text-sm text-[var(--text-subtle)]">
              Cuánto se usa el asistente, con qué resultado y cuántos tokens consume.
              {updatedAt ? ` Actualizado a las ${format(updatedAt, "HH:mm")}.` : ""}
            </p>
          </div>
          <button type="button" onClick={() => void fetchUsage()} className={quietButton}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Actualizar
          </button>
        </div>

        <div className="mb-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <label>
              <span className="sr-only">Periodo</span>
              <select
                value={hours}
                onChange={(event) => {
                  setHours(Number(event.target.value));
                  setPage(1);
                }}
                className={control}
              >
                {WINDOWS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[200px] flex-1">
              <span className="sr-only">Usuario</span>
              <select
                value={userId}
                onChange={(event) => {
                  setUserId(Number(event.target.value));
                  setPage(1);
                }}
                className={`${control} w-full`}
              >
                <option value={0}>Todos los usuarios</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Resultado</span>
              <select
                value={action}
                onChange={(event) => {
                  setAction(event.target.value);
                  setPage(1);
                }}
                className={control}
              >
                <option value="">Todos los resultados</option>
                <option value="execute">Preguntas respondidas</option>
                <option value="error">Con error</option>
                <option value="rate_limited">Límite excedido</option>
              </select>
            </label>
          </div>
        </div>

        <section aria-label="Resumen del periodo" className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat strong label="Preguntas" value={number(summary.total_requests)} />
          <Stat label="Respondidas bien" value={successRatio} hint={problems > 0 ? `${number(problems)} con error o límite` : undefined} />
          <Stat
            label="Respuestas"
            value={`${number(summary.ai_responses)} IA`}
            hint={`${number(summary.fallback_responses)} basadas en reglas`}
          />
          <Stat label="Tiempo de respuesta" value={summary.avg_latency_ms != null ? `${number(summary.avg_latency_ms)} ms` : "—"} hint="promedio" />
          <div className="col-span-2 md:col-span-4">
            <p className="text-sm text-[var(--text-muted)]">
              Tokens del periodo: <span className="font-mono-data text-[var(--text-main)]">{number(summary.total_prompt_tokens)}</span> de entrada y{" "}
              <span className="font-mono-data text-[var(--text-main)]">{number(summary.total_completion_tokens)}</span> de salida.
            </p>
          </div>
        </section>

        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-12 text-[var(--text-subtle)]">
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
            Cargando consumo…
          </div>
        ) : errorMessage ? (
          <div role="alert" className="rounded-[var(--radius)] border border-[var(--status-danger-text)]/30 bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-text)]">
            {errorMessage}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-10 text-center">
            <p className="text-base font-semibold text-[var(--text-main)]">{hasFilters ? "Ningún registro coincide con el filtro" : "Aún no hay preguntas en este periodo"}</p>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setAction("");
                  setUserId(0);
                  setPage(1);
                }}
                className={`${quietButton} mt-3`}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <h2 className="mb-2 text-sm font-semibold text-[var(--text-main)]">
              Registro <span className="font-normal text-[var(--text-muted)]">· {number(total)}</span>
            </h2>
            <ul className="space-y-2">
              {items.map((item) => {
                const failed = item.action === "error" || item.action === "rate_limited";
                return (
                  <li key={item.id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-3 md:px-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="text-[15px] font-semibold text-[var(--text-main)]">{item.user_name || item.user_email || "Sistema"}</p>
                      <p className="text-xs text-[var(--text-muted)]">{formatDateTime(item.created_at)}</p>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--text-muted)]">
                      <span className={failed ? "font-semibold text-[var(--status-danger-text)]" : "font-semibold text-[var(--text-main)]"}>
                        {ACTION_LABEL[item.action] ?? item.action}
                      </span>
                      {item.source && <span>{SOURCE_LABEL[item.source] ?? item.source}</span>}
                      {item.latency_ms != null && <span className="font-mono-data">{number(item.latency_ms)} ms</span>}
                      {(item.tokens_prompt != null || item.tokens_completion != null) && (
                        <span className="font-mono-data">
                          {item.tokens_prompt != null ? number(item.tokens_prompt) : "—"} / {item.tokens_completion != null ? number(item.tokens_completion) : "—"} tokens
                        </span>
                      )}
                    </p>
                    {(item.model || item.provider || item.status_code != null || item.error_detail) && (
                      <Disclosure summary="Detalles técnicos" className="-ml-3">
                        <p className="font-mono-data text-xs text-[var(--text-muted)]">
                          {[item.provider, item.model].filter(Boolean).join(" · ")}
                          {item.status_code != null ? ` · HTTP ${item.status_code}` : ""}
                          {item.error_detail ? ` · ${item.error_detail}` : ""}
                        </p>
                      </Disclosure>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {total > PAGE_SIZE && (
          <nav aria-label="Páginas del registro" className="mt-5 flex items-center justify-between gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className={quietButton}>
              Anterior
            </button>
            <span className="text-sm text-[var(--text-subtle)]">
              Página {page} de {totalPages}
            </span>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className={quietButton}>
              Siguiente
            </button>
          </nav>
        )}
      </div>
    </PageTransition>
  );
}
