import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getCachedModules, loadModules, MODULES_OFF, type Modules } from "../services/modules";

/** Módulos encendidos para la sesión actual; apagados mientras cargan o sin sesión. */
export function useModules(): Modules {
  const { user } = useAuth();
  const userKey = user ? String(user.sub ?? "") : null;
  const [state, setState] = useState<{ userKey: string | null; value: Modules | null }>(() => ({
    userKey,
    value: userKey === null ? null : getCachedModules(userKey),
  }));

  useEffect(() => {
    if (userKey === null) return;
    let cancelled = false;
    void loadModules(userKey).then((value) => {
      if (!cancelled) setState({ userKey, value });
    });
    return () => {
      cancelled = true;
    };
  }, [userKey]);

  if (userKey === null || state.userKey !== userKey) return MODULES_OFF;
  return state.value ?? MODULES_OFF;
}
