import { Loader2, Send } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { isAxiosError } from "axios";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Disclosure } from "../../components/Disclosure";
import { PageTransition } from "../../components/PageTransition";
import { useOptionalSelection } from "../../context/SelectionContext";
import { useAlertPlaces } from "../../hooks/useAlertPlaces";
import {
  askAIAssistant,
  AIChatMessage,
  AIChatWidget,
} from "../../services/aiAssistant";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";

interface ChatBubble {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: "ai" | "fallback";
  generatedAt?: string;
  provider?: string;
  model?: string;
  tokensPrompt?: number;
  tokensCompletion?: number;
  widgets?: AIChatWidget[];
}

function formatDateTime(isoValue?: string): string {
  if (!isoValue) return "";
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return isoValue;
  return parsed.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatWidgetValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    const abs = Math.abs(value);
    if (abs >= 1000) return value.toLocaleString("es-MX", { maximumFractionDigits: 0 });
    if (abs >= 100) return value.toLocaleString("es-MX", { maximumFractionDigits: 1 });
    return value.toLocaleString("es-MX", { maximumFractionDigits: 2 });
  }
  return String(value);
}

/** Tablas, tarjetas y gráficas que acompañan a una respuesta (sin cambios de contenido). */
function ChatWidgets({ messageId, widgets }: { messageId: string; widgets: AIChatWidget[] }) {
  return (
    <div className="mt-3 space-y-3">
      {widgets.map((widget, widgetIndex) => {
        if (widget.type === "kpi_cards") {
          const items = widget.items ?? [];
          return (
            <div
              key={`${messageId}-kpi-${widgetIndex}`}
              className="rounded-xl border border-[var(--border-subtle)] p-3"
            >
              {widget.title && (
                <h4 className="mb-2 text-sm font-medium text-[var(--text-body)]">
                  {widget.title}
                </h4>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {items.map((item, index) => (
                  <div
                    key={`${messageId}-kpi-item-${index}`}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-3 py-2"
                  >
                    <div className="text-xs text-[var(--text-subtle)]">
                      {item.label}
                    </div>
                    <div className="text-base font-medium text-[var(--text-body)]">
                      {formatWidgetValue(item.value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (widget.type === "table") {
          const columns = widget.columns ?? [];
          const rows = widget.rows ?? [];
          return (
            <div
              key={`${messageId}-table-${widgetIndex}`}
              className="rounded-xl border border-[var(--border-subtle)] p-3"
            >
              {widget.title && (
                <h4 className="mb-2 text-sm font-medium text-[var(--text-body)]">
                  {widget.title}
                </h4>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead key={`${messageId}-th-${column.key}`}>
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, rowIndex) => (
                    <TableRow key={`${messageId}-tr-${rowIndex}`}>
                      {columns.map((column) => (
                        <TableCell key={`${messageId}-td-${rowIndex}-${column.key}`}>
                          {formatWidgetValue(row[column.key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          );
        }

        if (widget.type === "line_chart") {
          const data = (widget.data ?? []) as Array<Record<string, string | number | null>>;
          const xKey = widget.x_key ?? "date";
          const series = widget.series ?? [];
          if (data.length === 0 || series.length === 0) {
            return null;
          }
          return (
            <div
              key={`${messageId}-line-${widgetIndex}`}
              className="rounded-xl border border-[var(--border-subtle)] p-3"
            >
              {widget.title && (
                <h4 className="mb-2 text-sm font-medium text-[var(--text-body)]">
                  {widget.title}
                </h4>
              )}
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    {series.map((serie) => (
                      <Line
                        key={`${messageId}-series-${serie.key}`}
                        type="monotone"
                        dataKey={serie.key}
                        name={serie.label}
                        stroke={serie.color || "var(--chart-1)"}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

const SUGGESTIONS = [
  "¿Qué áreas llevan más tiempo sin enviar datos?",
  "¿Cómo ha estado la humedad del suelo esta semana?",
  "¿Cuánta agua se usó en los últimos 7 días?",
  "¿Qué nodos no han reportado hoy?",
];

const control =
  "min-h-[44px] rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-panel)] px-3 text-sm text-[var(--text-body)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

/** Mensaje de error en español para quien pregunta (sin códigos HTTP). */
function friendlyError(error: unknown): string {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 503) return "El asistente no está disponible por ahora. Inténtalo más tarde.";
    if (status === 429) return "Hiciste muchas preguntas seguidas. Espera un momento e inténtalo de nuevo.";
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return "No fue posible obtener respuesta del asistente. Inténtalo de nuevo.";
}

/**
 * Preguntar al asistente: una conversación sobre tus predios, áreas y nodos. El alcance (predio y área) y la
 * ventana de datos se eligen en una fila sobre el chat; las respuestas pueden traer tarjetas, tablas y gráficas.
 */
export function AIChatPage() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const selection = useOptionalSelection();
  const { clientOf } = useAlertPlaces(isAdmin);
  const properties = selection?.properties ?? [];
  const areas = selection?.areas ?? [];

  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [hoursBack, setHoursBack] = useState(72);
  const [propertyId, setPropertyId] = useState(0);
  const [areaId, setAreaId] = useState(0);
  const initialisedRef = useRef(false);
  const streamTimerRef = useRef<number | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // El productor empieza en su predio y área elegidos; el admin, en todo (como antes).
  useEffect(() => {
    if (initialisedRef.current || !selection || selection.loading) return;
    initialisedRef.current = true;
    if (!isAdmin) {
      setPropertyId(selection.selectedProperty?.id ?? 0);
      setAreaId(selection.selectedArea?.id ?? 0);
    }
  }, [selection, selection?.loading, isAdmin]);

  const propertyAreas = useMemo(() => areas.filter((a) => a.property_id === propertyId), [areas, propertyId]);
  const scopedProperty = properties.find((p) => p.id === propertyId);
  const scopeLabel = useMemo(() => {
    const area = areas.find((a) => a.id === areaId);
    if (area && scopedProperty) return `${scopedProperty.name} › ${area.name}`;
    if (scopedProperty) return `todo ${scopedProperty.name}`;
    return isAdmin ? "todos los predios" : "todos tus predios";
  }, [areas, areaId, scopedProperty, isAdmin]);
  const windowLabel = hoursBack === 24 ? "las últimas 24 horas" : hoursBack === 168 ? "los últimos 7 días" : "las últimas 72 horas";

  const resetConversation = () => {
    if (streamTimerRef.current !== null) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    setIsStreaming(false);
    setMessages([]);
    setErrorMessage(null);
  };

  useEffect(() => {
    return () => {
      if (streamTimerRef.current !== null) {
        window.clearInterval(streamTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages, loading, isStreaming]);

  const streamAssistantText = (messageId: string, fullText: string, widgets: AIChatWidget[]) => {
    if (streamTimerRef.current !== null) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }

    if (!fullText) {
      setMessages((previous) => previous.map((item) => (item.id === messageId ? { ...item, widgets } : item)));
      setIsStreaming(false);
      return;
    }

    setIsStreaming(true);
    let index = 0;
    const totalLength = fullText.length;

    streamTimerRef.current = window.setInterval(() => {
      const remaining = totalLength - index;
      const step = remaining > 1000 ? 30 : remaining > 600 ? 20 : remaining > 300 ? 12 : 6;
      index = Math.min(totalLength, index + step);
      const partial = fullText.slice(0, index);

      setMessages((previous) => previous.map((item) => (item.id === messageId ? { ...item, content: partial } : item)));

      if (index >= totalLength) {
        if (streamTimerRef.current !== null) {
          window.clearInterval(streamTimerRef.current);
          streamTimerRef.current = null;
        }
        setMessages((previous) => previous.map((item) => (item.id === messageId ? { ...item, widgets } : item)));
        setIsStreaming(false);
      }
    }, 26);
  };

  const send = async (text: string) => {
    const userText = text.trim();
    if (!userText || loading || isStreaming) return;

    const userMessage: ChatBubble = { id: `user-${Date.now()}`, role: "user", content: userText };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setErrorMessage(null);

    const history: AIChatMessage[] = nextMessages.slice(-8).map((item) => ({ role: item.role, content: item.content }));

    try {
      const response = await askAIAssistant({
        message: userText,
        history,
        hours_back: hoursBack,
        client_id: isAdmin ? scopedProperty?.client_id : undefined,
        irrigation_area_id: areaId || undefined,
      });

      const assistantMessage: ChatBubble = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        source: response.source,
        generatedAt: response.generated_at,
        provider: typeof response.metadata.provider === "string" ? response.metadata.provider : undefined,
        model: typeof response.metadata.model === "string" ? response.metadata.model : undefined,
        tokensPrompt: typeof response.metadata.tokens_prompt === "number" ? response.metadata.tokens_prompt : undefined,
        tokensCompletion: typeof response.metadata.tokens_completion === "number" ? response.metadata.tokens_completion : undefined,
        widgets: [],
      };
      setMessages((previous) => [...previous, assistantMessage]);
      streamAssistantText(assistantMessage.id, response.answer, response.widgets ?? []);
    } catch (error) {
      console.error("Failed to send AI assistant message", error);
      setErrorMessage(friendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send(input);
  };

  return (
    <PageTransition>
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[900px] flex-col p-4 md:p-8">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-[var(--text-title)] md:text-3xl">Preguntar al asistente</h1>
          <p className="mt-1 text-sm text-[var(--text-subtle)]">
            Pregunta por tus predios, áreas y nodos. Responde con los datos de <strong className="font-semibold text-[var(--text-main)]">{scopeLabel}</strong> de {windowLabel}.
          </p>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
          <label className="min-w-[180px] flex-1">
            <span className="sr-only">Predio</span>
            <select
              value={propertyId}
              onChange={(event) => {
                setPropertyId(Number(event.target.value));
                setAreaId(0);
              }}
              className={`${control} w-full`}
            >
              <option value={0}>{isAdmin ? "Todos los predios" : "Todos mis predios"}</option>
              {properties.map((property) => {
                const client = clientOf(property.id);
                return (
                  <option key={property.id} value={property.id}>
                    {client ? `${client} › ${property.name}` : property.name}
                  </option>
                );
              })}
            </select>
          </label>
          {propertyId > 0 && (
            <label className="min-w-[160px] flex-1">
              <span className="sr-only">Área del predio</span>
              <select value={areaId} onChange={(event) => setAreaId(Number(event.target.value))} className={`${control} w-full`}>
                <option value={0}>Todas las áreas del predio ({propertyAreas.length})</option>
                {propertyAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span className="sr-only">Periodo de datos</span>
            <select value={hoursBack} onChange={(event) => setHoursBack(Number(event.target.value))} className={control}>
              <option value={24}>Últimas 24 horas</option>
              <option value={72}>Últimas 72 horas</option>
              <option value={168}>Últimos 7 días</option>
            </select>
          </label>
          <button
            type="button"
            onClick={resetConversation}
            disabled={messages.length === 0 && !errorMessage}
            className="inline-flex min-h-[44px] items-center rounded-[var(--radius)] border border-[var(--border-strong)] px-3 text-sm font-semibold text-[var(--text-body)] hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Nueva conversación
          </button>
        </div>

        <div
          ref={chatScrollRef}
          role="log"
          aria-live="polite"
          aria-label="Conversación con el asistente"
          className="min-h-[320px] flex-1 space-y-3 overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 md:p-4"
        >
          {messages.length === 0 ? (
            <div>
              <p className="mb-3 text-sm text-[var(--text-subtle)]">Escribe una pregunta o empieza con una de estas:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    disabled={loading || isStreaming}
                    className="min-h-[44px] rounded-[var(--radius)] border border-[var(--border-strong)] px-3 text-left text-sm text-[var(--text-body)] hover:bg-[var(--accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  className={`rounded-[var(--radius)] px-3 py-2.5 ${
                    isUser
                      ? "ml-auto max-w-[85%] bg-[var(--accent-primary)] text-[var(--text-inverted)]"
                      : "mr-auto max-w-[95%] border border-[var(--border)] bg-[var(--surface-panel)] text-[var(--text-body)]"
                  }`}
                >
                  {!isUser && <p className="mb-1 text-xs font-semibold text-[var(--text-muted)]">Asistente</p>}
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  {!isUser && (message.widgets?.length ?? 0) > 0 && <ChatWidgets messageId={message.id} widgets={message.widgets ?? []} />}
                  {!isUser && (
                    <div className="mt-2 text-xs text-[var(--text-muted)]">
                      {message.source === "ai" ? "Respuesta generada por IA" : "Respuesta basada en reglas"}
                      {message.generatedAt ? ` · ${formatDateTime(message.generatedAt)}` : ""}
                      {isAdmin && (message.provider || message.model || typeof message.tokensPrompt === "number") && (
                        <Disclosure summary="Detalles técnicos" className="-ml-3">
                          <p className="font-mono-data text-xs text-[var(--text-muted)]">
                            {[message.provider, message.model].filter(Boolean).join(" · ")}
                            {typeof message.tokensPrompt === "number" ? ` · entrada ${message.tokensPrompt}` : ""}
                            {typeof message.tokensCompletion === "number" ? ` · salida ${message.tokensCompletion}` : ""}
                          </p>
                        </Disclosure>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {(loading || isStreaming) && (
            <div role="status" className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-panel)] px-3 py-2 text-sm text-[var(--text-subtle)]">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              {loading ? "Pensando la respuesta…" : "Escribiendo…"}
            </div>
          )}
        </div>

        {errorMessage && (
          <div role="alert" className="mt-3 rounded-[var(--radius)] bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-text)]">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-3 flex items-stretch gap-2">
          <label className="block min-w-0 flex-1">
            <span className="sr-only">Tu pregunta</span>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Escribe tu pregunta… (Enter envía, Mayús+Enter salto de línea)"
              rows={2}
              className="block w-full resize-none rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-panel)] px-3 py-2 text-sm text-[var(--text-body)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            />
          </label>
          <button
            type="submit"
            disabled={loading || isStreaming || !input.trim()}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--text-inverted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send aria-hidden="true" className="h-4 w-4" />
            Enviar
          </button>
        </form>
      </div>
    </PageTransition>
  );
}
