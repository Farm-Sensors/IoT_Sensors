import { format } from "date-fns";
import { Download, FileSpreadsheet, FileText, Info } from "lucide-react";
import { useState } from "react";
import { BentoCard } from "../../components/BentoCard";
import { PageHeader } from "../../components/PageHeader";
import { PageTransition } from "../../components/PageTransition";
import { ReadingDateRangeSelector } from "../../components/ReadingDateRangeSelector";
import { SelectionScopeBar } from "../../components/selection/SelectionScopeBar";
import { useToast } from "../../components/Toast";
import { useSelection } from "../../context/SelectionContext";
import { downloadBlobExport } from "../../utils/export";
import { useReadingFilters } from "../../services/useReadingFilters";
import { readingQuery } from "../../utils/readingFilters";

type ExportFormat = "csv" | "xlsx" | "pdf";

const formatOptions = [
  { id: "csv" as const, icon: FileText, label: "CSV", desc: "Ligero y rápido" },
  { id: "xlsx" as const, icon: FileSpreadsheet, label: "Excel", desc: "Análisis detallado" },
  { id: "pdf" as const, icon: FileText, label: "PDF", desc: "Imprimible" },
];

export function ExportData() {
  const { selectedArea } = useSelection();
  return <AreaExport key={selectedArea?.id ?? "none"} />;
}

function AreaExport() {
  const { selectedArea } = useSelection();
  const { showToast } = useToast();

  const filters = useReadingFilters();
  const { startDate, endDate, cycleId } = filters;
  const [error, setError] = useState<string>();
  const [loadingFormat, setLoadingFormat] = useState<ExportFormat | null>(null);
  const loading = loadingFormat !== null;

  const handleExport = async (exportFormat: ExportFormat) => {
    if (loading) return;
    if (!selectedArea) {
      showToast("Por favor selecciona un área de riego.", "error");
      return;
    }

    try {
      setLoadingFormat(exportFormat);
      setError(undefined);
      const params = readingQuery(selectedArea.id, startDate, endDate, cycleId);
      params.set("format", exportFormat);

      const fileName = `export_${selectedArea.name}_${format(new Date(), "yyyy-MM-dd")}.${exportFormat}`;
      await downloadBlobExport(`/readings/export?${params}`, fileName);
      showToast("Exportación completada correctamente.", "success");
    } catch (err) {
      setError("No se pudo exportar. Intenta nuevamente.");
      showToast("Hubo un error al exportar los datos. Intenta nuevamente.", "error");
    } finally {
      setLoadingFormat(null);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <PageHeader
            title="Exportar Datos"
            subtitle="Descarga el histórico de tus sensores en diferentes formatos"
          />
          <SelectionScopeBar className="mb-1" />

          <BentoCard>
            <h2 className="mb-4 text-lg text-[var(--text-main)]">1. Elige qué datos</h2>
            <ReadingDateRangeSelector
              variant="soft"
              irrigationAreaId={selectedArea?.id}
              {...filters}
            />
          </BentoCard>

          <BentoCard>
            <h2 className="mb-1 text-lg text-[var(--text-main)]">2. Descarga</h2>
            <p className="mb-4 text-sm text-[var(--text-muted)]" data-testid="export-summary">
              {selectedArea
                ? `Se exportará ${selectedArea.name}, del ${format(startDate, "dd/MM/yyyy")} al ${format(endDate, "dd/MM/yyyy")}${cycleId !== undefined ? ", solo el ciclo de cultivo elegido" : ", todos los ciclos"}.`
                : "Selecciona un área de riego para exportar."}
            </p>
            <div role="group" aria-label="Formato de descarga" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {formatOptions.map(({ id, icon: Icon, label, desc }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => void handleExport(id)}
                  disabled={loading || !selectedArea}
                  aria-busy={loadingFormat === id}
                  className="flex min-h-[72px] items-center gap-4 rounded-[24px] border-2 border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-4 text-left transition-all
                    hover:border-[var(--accent-primary)]/40 hover:bg-[var(--hover-overlay)] active:scale-[0.98]
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)]"
                >
                  <Icon aria-hidden="true" className="h-7 w-7 flex-shrink-0 text-[var(--accent-primary)]" />
                  <span className="flex flex-col">
                    <span className="flex items-center gap-2 font-medium text-[var(--text-body)]">
                      <Download aria-hidden="true" className="h-4 w-4" />
                      {loadingFormat === id ? `Generando ${label}...` : `Descargar ${label}`}
                    </span>
                    <span className="text-sm text-[var(--text-subtle)]">{desc}</span>
                  </span>
                </button>
              ))}
            </div>
            {error && <p role="alert" className="mt-4 text-sm text-[var(--status-danger-text)]">{error}</p>}
          </BentoCard>

          <BentoCard className="bg-[var(--status-info-bg)] border border-[var(--status-info)]/20">
            <h2 className="mb-2 flex items-center gap-2 text-base font-medium text-[var(--text-body)]">
              <Info aria-hidden="true" className="h-4 w-4" /> Información sobre exportación
            </h2>
            <ul className="space-y-1 text-sm text-[var(--text-subtle)]">
              <li>• El archivo incluirá todos los datos del rango seleccionado</li>
              <li>• Los datos se exportan en formato estándar UTC</li>
              <li>• Las lecturas se muestran en sus unidades originales</li>
            </ul>
          </BentoCard>
        </div>
      </div>
    </PageTransition>
  );
}
