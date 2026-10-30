# Design: ui-redesign-3-history-export-map

Fixed by this brief:

- Filters keep their meaning and names: the presets in `utils/readingFilters.ts` `QUICK_RANGES`
  («Hoy», «Últimos 7 días», «Últimos 30 días», «Este mes», «Este año») plus «Personalizado»,
  default «Últimos 7 días», resolved in the frontend as today; crop cycle filter; the export uses
  exactly the same filters as the history view. Do not add, drop or rename presets.
- Export formats stay CSV, Excel (.xlsx) and PDF.
- Charts keep units on axes or tooltips, and never draw a `null` as `0`.
- The map keeps its data source and markers' meaning; only presentation, legend and controls
  may change. Status on markers is not color-only.
