# history-export Specification

## Purpose
TBD - created by archiving change ui-redesign-3-history-export-map. Update Purpose after archive.

## Requirements

### Requirement: Clear filters and export

History and export SHALL make the active filters visible at all times and SHALL keep the same
filter semantics and export formats.

#### Scenario: Apply a preset

- **WHEN** the client picks a date preset on `/cliente/historico`
- **THEN** the resolved start and end dates are visible next to the results

#### Scenario: Export what you see

- **WHEN** the client exports from `/cliente/exportar` after choosing filters
- **THEN** the chosen filters are summarized before downloading and the three formats are
  available as separate, labeled actions

#### Scenario: Phone width

- **WHEN** the pages are used at 390 px
- **THEN** filters, results and export actions are usable without horizontal page scrolling
