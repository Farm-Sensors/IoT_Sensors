import { format, isAfter, isBefore, parseISO, startOfDay, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Check, Info, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  className, preset, onPresetChange, cycleId, onCycleChange,
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
  const [minDate, setMinDate] = useState<Date | null>(null);
  const [maxDate, setMaxDate] = useState<Date | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  useEffect(() => {
    setMonth(startOfMonth(endDate));
  }, [endDate]);

  useEffect(() => {
    if (!irrigationAreaId) {
      setMinDate(null);
      setMaxDate(null);
      setAvailableDates([]);
      return;
    }

    let cancelled = false;

    const fetchAvailability = async () => {
      setLoadingAvailability(true);
      setAvailabilityError(false);
      setMinDate(null);
      setMaxDate(null);
      setAvailableDates([]);
      try {
        const params = new URLSearchParams({
          irrigation_area_id: irrigationAreaId.toString(),
          month_start: toIsoDate(startOfMonth(month)),
        });

        const res = await api.get<ReadingAvailabilityResponse>(`/readings/availability?${params}`);
        if (cancelled) return;

        setMinDate(res.data.min_date ? startOfDay(parseISO(res.data.min_date)) : null);
        setMaxDate(res.data.max_date ? startOfDay(parseISO(res.data.max_date)) : null);
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
    "flex min-h-[44px] w-full items-center gap-3 rounded-[24px] border border-[var(--border-strong)] bg-[var(--surface-card-primary)] px-4 py-2.5 text-[var(--text-main)] hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";
  const activeCycle = cycles.find((cycle) => cycle.id === cycleId);
  const rangeText = `${format(startDate, "dd/MM/yyyy")} – ${format(endDate, "dd/MM/yyyy")}`;
  const calendarModifiers = {
    available: (day: Date) => availableDateSet.has(toIsoDate(day)),
  };
  const calendarModifiersClassNames = {
    available: "font-semibold text-[var(--text-main)] after:absolute after:bottom-1 after:left-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-[var(--accent-primary)]",
  };

  return (
    <div className={cn("space-y-4", className)} data-variant={variant}>
      {onPresetChange && <div role="group" className="flex flex-wrap gap-2" aria-label="Rangos rápidos">
        {[...QUICK_RANGES, "Personalizado" as const].map((range) => <button key={range} type="button"
          aria-pressed={preset === range} onClick={() => onPresetChange(range)}
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 ${preset === range ? "bg-[var(--accent-primary)] text-[var(--text-inverted)]" : "border border-[var(--border-strong)] text-[var(--text-body)] hover:bg-[var(--hover-overlay)]"}`}>
          {preset === range && <Check aria-hidden="true" className="h-4 w-4" />}
          {range}
        </button>)}
      </div>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <span className="mb-2 block text-sm font-medium text-[var(--text-body)]">Fecha inicio</span>
          <Popover open={startOpen} onOpenChange={setStartOpen}>
            <PopoverTrigger asChild>
              <button type="button" aria-label="Fecha inicio" className={triggerBase}>
                <CalendarIcon aria-hidden="true" className="h-5 w-5 text-[var(--text-muted)]" />
                <span className="text-sm">{format(startDate, "dd/MM/yyyy")}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                locale={es}
                month={month}
                onMonthChange={setMonth}
                selected={startDate}
                onSelect={handleStartSelect}
                modifiers={calendarModifiers}
                modifiersClassNames={calendarModifiersClassNames}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-[var(--text-body)]">Fecha fin</span>
          <Popover open={endOpen} onOpenChange={setEndOpen}>
            <PopoverTrigger asChild>
              <button type="button" aria-label="Fecha fin" className={triggerBase}>
                <CalendarIcon aria-hidden="true" className="h-5 w-5 text-[var(--text-muted)]" />
                <span className="text-sm">{format(endDate, "dd/MM/yyyy")}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                locale={es}
                month={month}
                onMonthChange={setMonth}
                selected={endDate}
                onSelect={handleEndSelect}
                modifiers={calendarModifiers}
                modifiersClassNames={calendarModifiersClassNames}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {onCycleChange && <label className="block text-sm font-medium text-[var(--text-body)]">
        Ciclo de cultivo
        <select value={cycleId ?? ""} disabled={!irrigationAreaId || cyclesLoading || cyclesError}
          onChange={(event) => onCycleChange(event.target.value ? Number(event.target.value) : undefined)}
          className="mt-2 block min-h-[44px] w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-card-primary)] px-3 text-[var(--text-body)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60">
          <option value="">Todos los ciclos</option>
          {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.start_date} — {cycle.end_date ?? "Sin fecha de fin"}</option>)}
        </select>
      </label>}
      {cyclesLoading && <p role="status" className="text-sm text-[var(--text-muted)]">Cargando ciclos…</p>}
      {cyclesError && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-body)]">
        <p>No se pudieron cargar los ciclos.</p>
        <PillButton variant="outline" aria-label="Reintentar ciclos" onClick={() => setRetry((n) => n + 1)}>Reintentar</PillButton>
      </div>}
      {onCycleChange && irrigationAreaId && !cyclesLoading && !cyclesError && cycles.length === 0 && <p className="text-sm text-[var(--text-muted)]">Sin ciclos registrados para esta área.</p>}

      <div className="rounded-2xl bg-[var(--card-sand)] px-4 py-3 text-sm text-[var(--text-main)]" data-testid="active-filters">
        <p className="font-medium">Filtros activos</p>
        <ul className="mt-1 space-y-0.5">
          {preset && <li>Rango: {preset}</li>}
          <li>Fechas: {rangeText}</li>
          {onCycleChange && <li>Ciclo de cultivo: {activeCycle ? `${activeCycle.start_date} — ${activeCycle.end_date ?? "Sin fecha de fin"}` : "Todos los ciclos"}</li>}
        </ul>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--text-muted)]">
          <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>Fechas de consulta en UTC. El ciclo seleccionado se aplica junto con el rango de fechas.</span>
        </p>
      </div>

      {availabilityError && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-body)]">
        <p>No se pudo cargar la disponibilidad. Puedes elegir las fechas manualmente.</p>
        <PillButton variant="outline" aria-label="Reintentar disponibilidad" onClick={() => setRetry((n) => n + 1)}>Reintentar</PillButton>
      </div>}
      <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
        {loadingAvailability && (
          <span className="inline-flex items-center gap-1" role="status">
            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            Cargando disponibilidad...
          </span>
        )}
        {!loadingAvailability && minDate && maxDate && (
          <span>
            Disponible desde {format(minDate, "dd MMM yyyy", { locale: es })} hasta {format(maxDate, "dd MMM yyyy", { locale: es })}
          </span>
        )}
        {!loadingAvailability && availableDates.length > 0 && (
          <span>Días con lecturas en este mes: {availableDates.length}</span>
        )}
      </div>
    </div>
  );
}
