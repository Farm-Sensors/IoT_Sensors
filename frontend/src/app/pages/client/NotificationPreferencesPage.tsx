import { Check, Loader2, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BentoCard } from "../../components/BentoCard";
import { PageTransition } from "../../components/PageTransition";
import { SkeletonCard } from "../../components/SkeletonCard";
import { useSelection } from "../../context/SelectionContext";
import {
  NotificationAlertType,
  NotificationChannel,
  NotificationSeverity,
  bulkUpsertNotificationPreferences,
  getMyNotificationSettings,
  listNotificationPreferences,
  updateMyNotificationSettings,
} from "../../services/notificationPreferences";

const ALERT_TYPES: Array<{ value: NotificationAlertType; label: string }> = [
  { value: "threshold", label: "Umbral" },
  { value: "inactivity", label: "Inactividad" },
];

const SEVERITIES: Array<{ value: NotificationSeverity; label: string }> = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
];

const CHANNELS: Array<{ value: NotificationChannel; label: string }> = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
];

type AlertTypeBulkAction =
  | "enable_all"
  | "disable_all"
  | "enable_email"
  | "enable_whatsapp";

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
      setErrorMessage("No fue posible cargar la configuración de notificaciones");
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

  const applyAlertTypeBulkAction = (
    irrigationAreaId: number,
    alertType: NotificationAlertType,
    action: AlertTypeBulkAction,
  ) => {
    setPreferenceMap((previous) => {
      const next = { ...previous };

      for (const severity of SEVERITIES) {
        if (action === "enable_all" || action === "disable_all") {
          const enabled = action === "enable_all";
          for (const channel of CHANNELS) {
            next[
              prefKey(irrigationAreaId, alertType, severity.value, channel.value)
            ] = enabled;
          }
          continue;
        }

        const channelToEnable: NotificationChannel =
          action === "enable_email" ? "email" : "whatsapp";
        next[prefKey(irrigationAreaId, alertType, severity.value, channelToEnable)] =
          true;
      }

      return next;
    });
  };

  const isChannelFullyEnabled = (
    irrigationAreaId: number,
    alertType: NotificationAlertType,
    channel: NotificationChannel,
  ) =>
    SEVERITIES.every((severity) =>
      getCurrentValue(irrigationAreaId, alertType, severity.value, channel),
    );

  const setChannelEnabled = (
    irrigationAreaId: number,
    alertType: NotificationAlertType,
    channel: NotificationChannel,
    enabled: boolean,
  ) => {
    setPreferenceMap((previous) => {
      const next = { ...previous };
      for (const severity of SEVERITIES) {
        next[prefKey(irrigationAreaId, alertType, severity.value, channel)] = enabled;
      }
      return next;
    });
  };

  const getEnabledCountByAlertType = (
    irrigationAreaId: number,
    alertType: NotificationAlertType,
  ) => {
    let enabledCount = 0;
    for (const channel of CHANNELS) {
      for (const severity of SEVERITIES) {
        if (getCurrentValue(irrigationAreaId, alertType, severity.value, channel.value)) {
          enabledCount += 1;
        }
      }
    }
    return enabledCount;
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
        setSuccessMessage("No hay cambios para guardar");
      } else {
        setSuccessMessage("Preferencias guardadas correctamente");
      }

      await loadData();
    } catch (error) {
      console.error("Failed to save notification preferences", error);
      setErrorMessage("No fue posible guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  if (selectionLoading || loading) {
    return (
      <div className="min-h-screen p-4 md:p-6 lg:p-8 space-y-4">
        <div className="h-8 w-64 rounded-full animate-shimmer mb-2" />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={6} />
      </div>
    );
  }

  if (selectionError) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center text-red-600">
        {selectionError}
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl text-[var(--text-title)]">
            Cómo me avisan
          </h1>
          <p className="text-[var(--text-subtle)]">
            Configura qué alertas recibir por área, severidad y canal.
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] px-4 py-2 text-sm font-medium text-[var(--text-body)] hover:bg-[var(--hover-overlay)]"
          >
            <RefreshCw className="h-4 w-4" />
            Recargar
          </button>
          <button
            type="button"
            onClick={saveChanges}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar cambios
          </button>
        </div>
      </div>

      {errorMessage && (
        <BentoCard variant="light" className="mb-4 border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)]">
          <p className="text-[var(--status-danger-text)]">{errorMessage}</p>
        </BentoCard>
      )}
      {successMessage && (
        <BentoCard variant="light" className="mb-4 border border-[var(--status-active)]/30 bg-[var(--status-active-bg)]">
          <p className="text-[var(--status-active-text)]">{successMessage}</p>
        </BentoCard>
      )}

      <BentoCard variant="light" className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg text-[var(--text-title)]">Interruptor global</h2>
            <p className="text-sm text-[var(--text-subtle)]">
              Si está apagado, no se envía ninguna notificación externa.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-[var(--text-body)]">
            <input
              type="checkbox"
              checked={globalEnabled}
              onChange={(event) => setGlobalEnabled(event.target.checked)}
              className="h-5 w-5 rounded border-[var(--border-subtle)] text-[var(--accent-primary)]"
            />
            {globalEnabled ? "Activado" : "Desactivado"}
          </label>
        </div>
      </BentoCard>

      <div className="space-y-5">
        {properties.map((property) => {
          const propertyAreas = areas.filter((area) => area.property_id === property.id);
          if (propertyAreas.length === 0) {
            return null;
          }

          return (
            <BentoCard key={property.id} variant="light" className="space-y-4">
              <div>
                <h2 className="text-xl text-[var(--text-title)]">{property.name}</h2>
                <p className="text-sm text-[var(--text-subtle)]">
                  {property.location || "Ubicación no definida"}
                </p>
              </div>

              <div className="space-y-4">
                {propertyAreas.map((area) => (
                  <div
                    key={area.id}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card-primary)] p-4"
                  >
                    <h3 className="text-base text-[var(--text-body)] mb-3">{area.name}</h3>

                    <div className="grid gap-3 md:grid-cols-2">
                      {ALERT_TYPES.map((alertType) => (
                        <div
                          key={alertType.value}
                          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-secondary)] p-3"
                        >
                          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-[var(--text-title)]">
                                {alertType.label}
                              </h4>
                              <p className="text-xs text-[var(--text-subtle)]">
                                {getEnabledCountByAlertType(area.id, alertType.value)} de 6 activas
                              </p>
                            </div>
                            <div className="grid w-full grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  applyAlertTypeBulkAction(area.id, alertType.value, "enable_all")
                                }
                                className="w-full rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-body)] hover:bg-[var(--hover-overlay)] sm:w-auto"
                              >
                                Todo ON
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  applyAlertTypeBulkAction(area.id, alertType.value, "disable_all")
                                }
                                className="w-full rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-body)] hover:bg-[var(--hover-overlay)] sm:w-auto"
                              >
                                Todo OFF
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  applyAlertTypeBulkAction(area.id, alertType.value, "enable_email")
                                }
                                className="w-full rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-body)] hover:bg-[var(--hover-overlay)] sm:w-auto"
                              >
                                Email ON
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  applyAlertTypeBulkAction(
                                    area.id,
                                    alertType.value,
                                    "enable_whatsapp",
                                  )
                                }
                                className="w-full rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-body)] hover:bg-[var(--hover-overlay)] sm:w-auto"
                              >
                                WhatsApp ON
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="grid grid-cols-[118px_repeat(3,minmax(0,1fr))] items-center gap-2 sm:grid-cols-[130px_repeat(3,minmax(0,1fr))]">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                                  Canal
                                </span>
                                {SEVERITIES.map((severity) => (
                                  <span
                                    key={severity.value}
                                    className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]"
                                  >
                                    {severity.label}
                                  </span>
                                ))}
                              </div>

                            {CHANNELS.map((channel) => {
                              const channelEnabled = isChannelFullyEnabled(
                                area.id,
                                alertType.value,
                                channel.value,
                              );

                              return (
                                <div
                                  key={channel.value}
                                  className="grid grid-cols-[118px_repeat(3,minmax(0,1fr))] items-center gap-2 sm:grid-cols-[130px_repeat(3,minmax(0,1fr))]"
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setChannelEnabled(
                                        area.id,
                                        alertType.value,
                                        channel.value,
                                        !channelEnabled,
                                      )
                                    }
                                    className={`inline-flex items-center justify-between rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
                                      channelEnabled
                                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                                        : "border-[var(--border-subtle)] text-[var(--text-body)] hover:bg-[var(--hover-overlay)]"
                                    }`}
                                  >
                                    <span>{channel.label}</span>
                                    <span>{channelEnabled ? "On" : "Off"}</span>
                                  </button>

                                  {SEVERITIES.map((severity) => {
                                    const checked = getCurrentValue(
                                      area.id,
                                      alertType.value,
                                      severity.value,
                                      channel.value,
                                    );

                                    return (
                                      <button
                                        key={severity.value}
                                        type="button"
                                        aria-pressed={checked}
                                        onClick={() =>
                                          togglePreference(
                                            area.id,
                                            alertType.value,
                                            severity.value,
                                            channel.value,
                                          )
                                        }
                                        className={`inline-flex h-9 items-center justify-center rounded-lg border text-xs font-semibold transition-colors ${
                                          checked
                                            ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--text-inverted)]"
                                            : "border-[var(--border-subtle)] bg-[var(--surface-card-primary)] text-[var(--text-subtle)] hover:bg-[var(--hover-overlay)]"
                                        }`}
                                      >
                                        {checked ? <Check className="h-3.5 w-3.5" /> : "--"}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </BentoCard>
          );
        })}
      </div>

      {!hasChanges && (
        <p className="mt-4 text-sm text-[var(--text-subtle)]">
          No hay cambios pendientes por guardar.
        </p>
      )}
    </div>
    </PageTransition>
  );
}
