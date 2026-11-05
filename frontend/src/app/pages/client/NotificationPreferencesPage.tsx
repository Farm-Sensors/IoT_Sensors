import { Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Disclosure } from "../../components/Disclosure";
import { PageTransition } from "../../components/PageTransition";
import { SkeletonCard } from "../../components/SkeletonCard";
import { useSelection } from "../../context/SelectionContext";
import { SEVERITY_META } from "../shared/alertFormat";
import {
  NotificationAlertType,
  NotificationChannel,
  NotificationSeverity,
  bulkUpsertNotificationPreferences,
  getMyNotificationSettings,
  listNotificationPreferences,
  updateMyNotificationSettings,
} from "../../services/notificationPreferences";

/** Cuándo se avisa: lo que pasó, en palabras (los valores internos son `threshold` e `inactivity`). */
const ALERT_TYPES: Array<{ value: NotificationAlertType; label: string }> = [
  { value: "threshold", label: "Una medición sale de su umbral" },
  { value: "inactivity", label: "Un nodo deja de enviar datos" },
];

const SEVERITIES: Array<{ value: NotificationSeverity; label: string }> = [
  { value: "critical", label: "Crítica" },
  { value: "warning", label: "Aviso" },
  { value: "info", label: "Información" },
];

const CHANNELS: Array<{ value: NotificationChannel; label: string }> = [
  { value: "email", label: "Correo" },
  { value: "whatsapp", label: "WhatsApp" },
];

function prefKey(
  irrigationAreaId: number,
  alertType: NotificationAlertType,
  severity: NotificationSeverity,
  channel: NotificationChannel,
): string {
  return `${irrigationAreaId}|${alertType}|${severity}|${channel}`;
}

function parsePrefKey(key: string): {
  irrigationAreaId: number;
  alertType: NotificationAlertType;
  severity: NotificationSeverity;
  channel: NotificationChannel;
} {
  const [areaId, alertType, severity, channel] = key.split("|");
  return {
    irrigationAreaId: Number(areaId),
    alertType: alertType as NotificationAlertType,
    severity: severity as NotificationSeverity,
    channel: channel as NotificationChannel,
  };
}

export function NotificationPreferencesPage() {
  const { properties, areas, loading: selectionLoading, error: selectionError } =
    useSelection();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [baselineGlobalEnabled, setBaselineGlobalEnabled] = useState(true);

  const [preferenceMap, setPreferenceMap] = useState<Record<string, boolean>>({});
  const [baselineMap, setBaselineMap] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const [settings, preferences] = await Promise.all([
        getMyNotificationSettings(),
        listNotificationPreferences({ page: 1, per_page: 500 }),
      ]);

      const mapped: Record<string, boolean> = {};
      for (const item of preferences.data) {
        mapped[
          prefKey(
            item.irrigation_area_id,
            item.alert_type,
            item.severity,
            item.channel,
          )
        ] = item.enabled;
      }

      setGlobalEnabled(settings.notifications_enabled);
      setBaselineGlobalEnabled(settings.notifications_enabled);
      setPreferenceMap(mapped);
      setBaselineMap(mapped);
    } catch (error) {
      console.error("Failed to load notification preferences", error);
      setErrorMessage("No fue posible cargar tus avisos. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const hasChanges = useMemo(() => {
    if (globalEnabled !== baselineGlobalEnabled) {
      return true;
    }

    const keys = new Set([
      ...Object.keys(preferenceMap),
      ...Object.keys(baselineMap),
    ]);
    for (const key of keys) {
      const current = key in preferenceMap ? preferenceMap[key] : true;
      const baseline = key in baselineMap ? baselineMap[key] : true;
      if (current !== baseline) {
        return true;
      }
    }
    return false;
  }, [globalEnabled, baselineGlobalEnabled, preferenceMap, baselineMap]);

  const getCurrentValue = (
    irrigationAreaId: number,
    alertType: NotificationAlertType,
    severity: NotificationSeverity,
    channel: NotificationChannel,
  ): boolean => {
    const key = prefKey(irrigationAreaId, alertType, severity, channel);
    return key in preferenceMap ? preferenceMap[key] : true;
  };

  const togglePreference = (
    irrigationAreaId: number,
    alertType: NotificationAlertType,
    severity: NotificationSeverity,
    channel: NotificationChannel,
  ) => {
    const key = prefKey(irrigationAreaId, alertType, severity, channel);
    const current = key in preferenceMap ? preferenceMap[key] : true;
    setPreferenceMap((previous) => ({
      ...previous,
      [key]: !current,
    }));
  };

  /** Cuántos de los 6 avisos (2 situaciones × 3 gravedades) de un área llegan por este canal. */
  const countFor = (irrigationAreaId: number, channel: NotificationChannel) => {
    let count = 0;
    for (const alertType of ALERT_TYPES) {
      for (const severity of SEVERITIES) {
        if (getCurrentValue(irrigationAreaId, alertType.value, severity.value, channel)) count += 1;
      }
    }
    return count;
  };

  const setAreaAll = (irrigationAreaId: number, enabled: boolean) => {
    setPreferenceMap((previous) => {
      const next = { ...previous };
      for (const alertType of ALERT_TYPES) {
        for (const severity of SEVERITIES) {
          for (const channel of CHANNELS) {
            next[prefKey(irrigationAreaId, alertType.value, severity.value, channel.value)] = enabled;
          }
        }
      }
      return next;
    });
  };

  const discardChanges = () => {
    setPreferenceMap(baselineMap);
    setGlobalEnabled(baselineGlobalEnabled);
    setSuccessMessage(null);
  };

  const saveChanges = async () => {
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const changedItems = Object.keys(preferenceMap)
        .map((key) => {
          const current = preferenceMap[key];
          const baseline = key in baselineMap ? baselineMap[key] : true;
          if (current === baseline) {
            return null;
          }
          const parsed = parsePrefKey(key);
          return {
            irrigation_area_id: parsed.irrigationAreaId,
            alert_type: parsed.alertType,
            severity: parsed.severity,
            channel: parsed.channel,
            enabled: current,
          };
        })
        .filter((item) => item !== null);

      if (globalEnabled !== baselineGlobalEnabled) {
        await updateMyNotificationSettings(globalEnabled);
      }

      if (changedItems.length > 0) {
        await bulkUpsertNotificationPreferences(changedItems);
      }

      if (globalEnabled === baselineGlobalEnabled && changedItems.length === 0) {
        setSuccessMessage("No hay cambios que guardar.");
      } else {
        setSuccessMessage("Cambios guardados.");
      }

      await loadData();
    } catch (error) {
      console.error("Failed to save notification preferences", error);
      setErrorMessage("No fue posible guardar los cambios. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  if (selectionLoading || loading) {
    return (
      <div className="mx-auto max-w-[900px] space-y-4 p-4 md:p-8" role="status" aria-label="Cargando tus avisos">
        <div className="mb-2 h-8 w-64 animate-shimmer rounded-full" />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={6} />
      </div>
    );
  }

  if (selectionError) {
    return (
      <div role="alert" className="flex min-h-[40vh] items-center justify-center p-6 text-[var(--status-danger-text)]">
        {selectionError}
      </div>
    );
  }

  const groups = properties
    .map((property) => ({ property, areas: areas.filter((area) => area.property_id === property.id) }))
    .filter((group) => group.areas.length > 0);

  return (
    <PageTransition>
      <div className="mx-auto max-w-[900px] p-4 pb-28 md:p-8 md:pb-28">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold text-[var(--text-title)] md:text-3xl">Avisos por correo y WhatsApp</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--text-subtle)]">
            Elige por dónde quieres recibir cada alerta, según el área y la gravedad. Siempre las verás también en la plataforma.
          </p>
        </div>

        {errorMessage && (
          <p role="alert" className="mb-4 rounded-[var(--radius)] border border-[var(--status-danger-text)]/30 bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-text)]">
            {errorMessage}
          </p>
        )}
        {successMessage && (
          <p role="status" className="mb-4 rounded-[var(--radius)] bg-[var(--status-active-bg)] px-3 py-2 text-sm text-[var(--status-active-text)]">
            {successMessage}
          </p>
        )}

        <div className="mb-6 flex items-center justify-between gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-title)]">Recibir avisos fuera de la plataforma</h2>
            <p className="text-sm text-[var(--text-subtle)]">
              {globalEnabled ? "Te llegan por correo y WhatsApp según lo que elijas abajo." : "Apagado: no te llega ningún correo ni mensaje de WhatsApp."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={globalEnabled}
            aria-label="Recibir avisos fuera de la plataforma"
            onClick={() => setGlobalEnabled((value) => !value)}
            className={`relative h-8 w-14 flex-shrink-0 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 ${
              globalEnabled ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]" : "border-[var(--border-strong)] bg-[var(--surface-panel)]"
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-[var(--card)] shadow transition-all ${globalEnabled ? "left-[1.75rem]" : "left-0.5 border border-[var(--border-strong)]"}`}
            />
          </button>
        </div>

        <div className={`space-y-6 ${globalEnabled ? "" : "opacity-60"}`}>
          {groups.map(({ property, areas: propertyAreas }) => (
            <section key={property.id} aria-labelledby={`avisos-predio-${property.id}`}>
              <h2 id={`avisos-predio-${property.id}`} className="mb-2 text-sm font-semibold text-[var(--text-main)]">
                {property.name}
                {property.location ? <span className="font-normal text-[var(--text-muted)]"> · {property.location}</span> : null}
              </h2>
              <ul className="space-y-2">
                {propertyAreas.map((area) => (
                  <li key={area.id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 md:px-4">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <p className="text-[15px] font-semibold text-[var(--text-main)]">{area.name}</p>
                      <p className="font-mono-data text-xs text-[var(--text-muted)]">
                        {CHANNELS.map((channel) => `${channel.label} ${countFor(area.id, channel.value)}/6`).join(" · ")}
                      </p>
                    </div>
                    <Disclosure summary="Elegir avisos" className="-ml-3">
                      <div className="mb-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setAreaAll(area.id, true)}
                          className="min-h-[44px] rounded-[var(--radius)] border border-[var(--border-strong)] px-3 text-sm font-semibold text-[var(--text-body)] hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        >
                          Activar todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setAreaAll(area.id, false)}
                          className="min-h-[44px] rounded-[var(--radius)] border border-[var(--border-strong)] px-3 text-sm font-semibold text-[var(--text-body)] hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        >
                          Desactivar todos
                        </button>
                      </div>
                      <p className="mb-2 text-sm text-[var(--text-muted)]">
                        La gravedad la define cada umbral. <strong className="font-semibold text-[var(--text-main)]">Crítica:</strong> algo urgente.{" "}
                        <strong className="font-semibold text-[var(--text-main)]">Aviso:</strong> conviene revisarlo.{" "}
                        <strong className="font-semibold text-[var(--text-main)]">Información:</strong> solo para que lo sepas.
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                          <caption className="sr-only">Avisos de {area.name} por situación, canal y gravedad</caption>
                          <thead>
                            <tr className="border-b border-[var(--border)]">
                              <th scope="col" className="py-2 pr-2 text-xs font-semibold text-[var(--text-muted)]">Por</th>
                              {SEVERITIES.map((severity) => {
                                const meta = SEVERITY_META[severity.value];
                                const Icon = meta.icon;
                                return (
                                  <th key={severity.value} scope="col" className="px-1 py-2 text-center text-[11px] font-semibold sm:text-xs">
                                    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 sm:px-2 ${meta.bg} ${meta.text}`}>
                                      <Icon aria-hidden="true" className="hidden h-3.5 w-3.5 sm:block" />
                                      {severity.label}
                                    </span>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          {ALERT_TYPES.map((alertType) => (
                            <tbody key={alertType.value}>
                              <tr>
                                <th scope="colgroup" colSpan={SEVERITIES.length + 1} className="pb-1 pt-3 text-left text-sm font-semibold text-[var(--text-main)]">
                                  {alertType.label}
                                </th>
                              </tr>
                              {CHANNELS.map((channel) => (
                                <tr key={channel.value} className="border-b border-[var(--border)] last:border-b-0">
                                  <th scope="row" className="py-1 pr-2 text-left text-sm font-normal text-[var(--text-body)]">{channel.label}</th>
                                  {SEVERITIES.map((severity) => (
                                    <td key={severity.value} className="px-1 py-0.5 text-center">
                                      <label className="inline-flex h-11 w-11 cursor-pointer items-center justify-center">
                                        <input
                                          type="checkbox"
                                          checked={getCurrentValue(area.id, alertType.value, severity.value, channel.value)}
                                          onChange={() => togglePreference(area.id, alertType.value, severity.value, channel.value)}
                                          aria-label={`${channel.label}, gravedad ${severity.label.toLowerCase()}: ${alertType.label.toLowerCase()}`}
                                          className="h-5 w-5 accent-[var(--accent-primary)]"
                                        />
                                      </label>
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          ))}
                        </table>
                      </div>
                    </Disclosure>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {groups.length === 0 && (
          <p className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
            Aún no tienes áreas de riego. Cuando tengas una, podrás elegir cómo recibir sus avisos.
          </p>
        )}

        {hasChanges && (
          <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 border-t border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 py-3 md:bottom-0 md:left-[208px]">
            <div className="mx-auto flex max-w-[900px] flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--text-main)]">Tienes cambios sin guardar</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={discardChanges}
                  disabled={saving}
                  className="min-h-[44px] rounded-[var(--radius)] border border-[var(--border-strong)] px-4 text-sm font-semibold text-[var(--text-body)] hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={saveChanges}
                  disabled={saving}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius)] bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--text-inverted)] hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Save aria-hidden="true" className="h-4 w-4" />}
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
