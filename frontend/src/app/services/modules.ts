import { api } from "./api";

/** Módulos opcionales (Fase 2) encendidos por flags del servidor; todos OFF por defecto. */
export interface Modules {
  alerts: boolean;
  ai_assistant: boolean;
  ai_reports: boolean;
  notifications: boolean;
}

export type ModuleKey = keyof Modules;

export const MODULES_OFF: Modules = {
  alerts: false,
  ai_assistant: false,
  ai_reports: false,
  notifications: false,
};

interface ModulesCacheEntry {
  userKey: string;
  promise: Promise<Modules>;
  value: Modules | null;
}

let cache: ModulesCacheEntry | null = null;

/**
 * Pide `/settings/modules` una sola vez por sesión de usuario. Si falla, los
 * módulos quedan apagados (las rutas directas siguen funcionando) y el
 * siguiente intento vuelve a consultar.
 */
export function loadModules(userKey: string): Promise<Modules> {
  if (cache?.userKey === userKey) return cache.promise;
  const entry: ModulesCacheEntry = {
    userKey,
    value: null,
    promise: api
      .get<Modules>("/settings/modules")
      .then(({ data }) => {
        entry.value = data;
        return data;
      })
      .catch(() => {
        if (cache === entry) cache = null;
        return MODULES_OFF;
      }),
  };
  cache = entry;
  return entry.promise;
}

/** Último valor ya resuelto para este usuario, o `null` si aún no llega. */
export function getCachedModules(userKey: string): Modules | null {
  return cache?.userKey === userKey ? cache.value : null;
}

/** Olvida los módulos (al cerrar sesión) para volver a pedirlos en el siguiente login. */
export function clearModulesCache(): void {
  cache = null;
}
