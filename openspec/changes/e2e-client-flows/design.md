# Design: e2e-client-flows

Use the `clientPage` fixture (no form logins). Both files run in the `desktop` and `mobile`
projects.

| File | Flow and assertions |
|---|---|
| `client-dashboard.spec.ts` | `/cliente`: choose predio «DEMO - Rancho Norte» and área «DEMO - Nogal Norte»; «Humedad del Suelo», «Flujo de Agua» and «E.T.O.» are visible with their units; the freshness text is visible; choosing área «DEMO - Alfalfa Este» changes the área shown. The predio/área selects have no accessible name today: locate them through the closest element that has one and list them under "Sin nombre accesible" in the PR. |
| `history-export.spec.ts` | `HistoricalData.tsx` for «DEMO - Nogal Norte»: preset «Últimos 7 días» shows data (the demo seed covers the last 30 days); «Personalizado» with «Fecha inicio»/«Fecha fin» (date-picker popovers) set to a month two years ago shows the empty state. `ExportData.tsx`: export CSV, Excel and PDF with «Últimos 7 días»; each triggers a download whose file name ends in `.csv`, `.xlsx`, `.pdf` and whose size is > 0. |

Exact headings, buttons and labels come from `pages/client/ClientDashboard.tsx`,
`pages/client/dashboard/`, `pages/client/HistoricalData.tsx`, `pages/client/ExportData.tsx` and
`components/ReadingDateRangeSelector.tsx`.
