import { format, isAfter, isBefore, startOfDay, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Info, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../services/api";
import type { PaginatedResponse } from "../types/api";
import { QUICK_RANGES, type DateRangeMode } from "../utils/readingFilters";
import { PillButton } from "./PillButton";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "./ui/utils";

type DateRangeSelectorVariant = "soft" | "bordered";

interface ReadingAvailabilityResponse {
  min_date: string | null;
  max_date: string | null;
  available_dates: string[];
}

interface ReadingDateRangeSelectorProps {
  startDate: Date;
  endDate: Date;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
  irrigationAreaId?: number;
  variant?: DateRangeSelectorVariant;
  className?: string;
  preset?: DateRangeMode;
  onPresetChange?: (preset: DateRangeMode) => void;
  cycleId?: number;
  onCycleChange?: (cycleId?: number) => void;
  /** Contenido a la derecha de la línea de resumen (p. ej. las descargas). */
  trailing?: ReactNode;
}

function toIsoDate(day: Date): string {
  return format(day, "yyyy-MM-dd");
}

export function ReadingDateRangeSelector({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  irrigationAreaId,
  variant = "soft",
  className, preset, onPresetChange, cycleId, onCycleChange, trailing,
}: ReadingDateRangeSelectorProps) {
  const [cycles, setCycles] = useState<{ id: number; irrigation_area_id: number; start_date: string; end_date: string | null }[]>([]);
  const [cyclesLoading, setCyclesLoading] = useState(false);
  const [cyclesError, setCyclesError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [availabilityError, setAvailabilityError] = useState(false);
  useEffect(() => {
    setCycles([]);
    setCyclesError(false);
    if (!irrigationAreaId) { setCyclesLoading(false); return; }
    const controller = new AbortController();
    setCyclesLoading(true);
    const load = async () => {
      try {
        const all: typeof cycles = [];
        for (let page = 1; !controller.signal.aborted; page += 1) {
          const params = new URLSearchParams({ irrigation_area_id: String(irrigationAreaId), page: String(page), per_page: "200" });
          const response = await api.get<PaginatedResponse<(typeof cycles)[number]>>(`/crop-cycles?${params}`, { signal: controller.signal });
          all.push(...response.data.data);
          if (all.length >= response.data.total || response.data.data.length === 0) break;
        }
        if (!controller.signal.aborted) setCycles(all.filter((cycle) => cycle.irrigation_area_id === irrigationAreaId));
      } catch {
        if (!controller.signal.aborted) setCyclesError(true);
      } finally {
        if (!controller.signal.aborted) setCyclesLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [irrigationAreaId, retry]);
  const [month, setMonth] = useState<Date>(startOfMonth(endDate));
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  useEffect(() => {
    setMonth(startOfMonth(endDate));
  }, [endDate]);

  useEffect(() => {
    if (!irrigationAreaId) {
      setAvailableDates([]);
      return;
    }

    let cancelled = false;

    const fetchAvailability = async () => {
      setLoadingAvailability(true);
      setAvailabilityError(false);
      setAvailableDates([]);
      try {
        const params = new URLSearchParams({
          irrigation_area_id: irrigationAreaId.toString(),
          month_start: toIsoDate(startOfMonth(month)),
        });

        const res = await api.get<ReadingAvailabilityResponse>(`/readings/availability?${params}`);
        if (cancelled) return;
        setAvailableDates(res.data.available_dates ?? []);
      } catch (error) {
        if (!cancelled) {
          setAvailableDates([]);
          setAvailabilityError(true);
        }
        console.error("Failed to fetch reading availability", error);
      } finally {
        if (!cancelled) {
          setLoadingAvailability(false);
        }
      }
    };

    fetchAvailability();

    return () => {
      cancelled = true;
    };
  }, [irrigationAreaId, month, retry]);

  const availableDateSet = useMemo(() => new Set(availableDates), [availableDates]);

  const handleStartSelect = (date: Date | undefined) => {
    if (!date) return;
    const nextStart = startOfDay(date);
    onStartDateChange(nextStart);
    if (isAfter(nextStart, startOfDay(endDate))) {
      onEndDateChange(nextStart);
    }
    setStartOpen(false);
  };

  const handleEndSelect = (date: Date | undefined) => {
    if (!date) return;
    const nextEnd = startOfDay(date);
    onEndDateChange(nextEnd);
    if (isBefore(nextEnd, startOfDay(startDate))) {
      onStartDateChange(nextEnd);
    }
    setEndOpen(false);
  };

  const triggerBase =
    "flex min-h-[40px] w-full items-center gap-2 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--card)] px-3 py-2 text-[var(--text-main)] hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";
  const activeCycle = cycles.find((cycle) => cycle.id === cycleId);
  const rangeText = `${format(startDate, "dd/MM/yyyy")} – ${format(endDate, "dd/MM/yyyy")}`;
  const calendarModifiers = {
    available: (day: Date) => availableDateSet.has(toIsoDate(day)),
  };
  const calendarModifiersClassNames = {
    available: "font-semibold text-[var(--text-main)] after:absolute after:bottom-1 after:left-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-[var(--accent-primary)]",
  };

  const customRange = !onPresetChange || preset === "Personalizado";
  const cycleText = activeCycle ? `Ciclo ${activeCycle.start_date} — ${activeCycle.end_date ?? "sin fecha de fin"}` : "Todos los ciclos";

  return (
    <div className={cn("space-y-3", className)} data-variant={variant}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        {onPresetChange && (
          <div role="group" aria-label="Rangos rápidos" className="inline-flex max-w-full flex-wrap gap-0.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-1">
            {[...QUICK_RANGES, "Personalizado" as const].map((range) => (
              <button key={range} type="button" aria-pressed={preset === range} onClick={() => onPresetChange(range)}
                className={`inline-flex min-h-[40px] items-center rounded-[var(--radius)] px-3 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${preset === range ? "bg-[var(--accent-primary)] font-semibold text-[var(--text-inverted)]" : "font-medium text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--text-main)]"}`}>
                {range}
              </button>
            ))}
          </div>
        )}
        {onCycleChange && (
          <label className="block text-xs text-[var(--text-muted)]">
            Ciclo de cultivo
            <select value={cycleId ?? ""} disabled={!irrigationAreaId || cyclesLoading || cyclesError}
              onChange={(event) => onCycleChange(event.target.value ? Number(event.target.value) : undefined)}
              className="mt-1 block min-h-[40px] min-w-[200px] rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--card)] px-3 text-sm text-[var(--text-body)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60">
              <option value="">Todos los ciclos</option>
              {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.start_date} — {cycle.end_date ?? "Sin fecha de fin"}</option>)}
            </select>
          </label>
        )}
      </div>

      {customRange && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-xs text-[var(--text-muted)]">Fecha inicio</span>
            <Popover open={startOpen} onOpenChange={setStartOpen}>
              <PopoverTrigger asChild>
                <button type="button" aria-label="Fecha inicio" className={triggerBase}>
                  <CalendarIcon aria-hidden="true" className="h-4 w-4 text-[var(--text-muted)]" />
                  <span className="text-sm">{format(startDate, "dd/MM/yyyy")}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" locale={es} month={month} onMonthChange={setMonth} selected={startDate} onSelect={handleStartSelect}
                  modifiers={calendarModifiers} modifiersClassNames={calendarModifiersClassNames} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <span className="mb-1 block text-xs text-[var(--text-muted)]">Fecha fin</span>
            <Popover open={endOpen} onOpenChange={setEndOpen}>
              <PopoverTrigger asChild>
                <button type="button" aria-label="Fecha fin" className={triggerBase}>
                  <CalendarIcon aria-hidden="true" className="h-4 w-4 text-[var(--text-muted)]" />
                  <span className="text-sm">{format(endDate, "dd/MM/yyyy")}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" locale={es} month={month} onMonthChange={setMonth} selected={endDate} onSelect={handleEndSelect}
                  modifiers={calendarModifiers} modifiersClassNames={calendarModifiersClassNames} />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      {cyclesLoading && <p role="status" className="text-sm text-[var(--text-muted)]">Cargando ciclos…</p>}
      {cyclesError && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-body)]">
        <p>No se pudieron cargar los ciclos.</p>
        <PillButton variant="outline" aria-label="Reintentar ciclos" onClick={() => setRetry((n) => n + 1)}>Reintentar</PillButton>
      </div>}
      {availabilityError && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-body)]">
        <p>No se pudo cargar la disponibilidad. Puedes elegir las fechas manualmente.</p>
        <PillButton variant="outline" aria-label="Reintentar disponibilidad" onClick={() => setRetry((n) => n + 1)}>Reintentar</PillButton>
      </div>}

      {/* Una sola línea de resumen del filtro, con las descargas a la derecha. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-[var(--border)] pt-3 text-sm" data-testid="active-filters">
        <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--text-main)]">
          <span className="font-medium">{preset ?? "Rango"}</span>
          <span className="font-mono-data text-[var(--text-muted)]">{rangeText}</span>
          <span className="text-[var(--text-muted)]">· {cycleText}</span>
          <span title="El rango se consulta por fecha en UTC; las horas de la gráfica y la tabla se muestran en tu zona horaria local." className="inline-flex text-[var(--text-muted)]">
            <Info aria-hidden="true" className="h-3.5 w-3.5" /><span className="sr-only">Las fechas se consultan en UTC; las horas se muestran en tu zona horaria local.</span>
          </span>
          {loadingAvailability && <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin text-[var(--text-muted)]" />}
        </p>
        {trailing}
      </div>
    </div>
  );
}
