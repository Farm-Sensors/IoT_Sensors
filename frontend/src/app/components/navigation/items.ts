import {
  Bell,
  Home,
  MapPin,
  MessageCircle,
  Network,
  Sprout,
  User,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { MODULES_OFF, type ModuleKey, type Modules } from "../../services/modules";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Label corto usado en la barra de pestañas móvil; cae a `label` si no existe. */
  mobileLabel?: string;
  /** Prefijos de ruta que también marcan este destino como actual (la ruta de `path` siempre cuenta). */
  match?: string[];
  /** Solo es actual con la ruta exacta (portadas: `/cliente`, `/admin`). */
  exact?: boolean;
}

/** Pestaña interna de una sección; `module` la oculta si ese módulo (Fase 2) está apagado. */
export interface SectionTab {
  path: string;
  label: string;
  /** Prefijos de ruta que marcan esta pestaña como actual. */
  match?: string[];
  module?: ModuleKey;
}

interface NavSection {
  label: string;
  mobileLabel?: string;
  icon: LucideIcon;
  tabs: SectionTab[];
}

/**
 * Navegación por cosas, no por herramientas (docs/redesign/v2/02-arquitectura.md).
 * Las pantallas de Fase 2 se agrupan en dos secciones con pestañas (docs/redesign/v2/20-navegacion-fase-2.md):
 * «Alertas» (mis alertas, umbrales y canales de aviso) y «Asistente» (preguntar, reportes automáticos y consumo).
 * Las rutas no cambian de dirección y cada módulo sigue ocultándose con su flag.
 */
const clientAlerts: NavSection = {
  label: "Alertas",
  icon: Bell,
  tabs: [
    { path: "/cliente/alertas", label: "Mis alertas", module: "alerts" },
    { path: "/cliente/umbrales", label: "Umbrales", module: "alerts" },
    { path: "/cliente/notificaciones", label: "Correo y WhatsApp", module: "notifications" },
  ],
};
const clientAssistant: NavSection = {
  label: "Asistente",
  icon: MessageCircle,
  tabs: [
    { path: "/cliente/asistente-ia", label: "Preguntar", module: "ai_assistant" },
    { path: "/cliente/reportes-ia", label: "Reportes automáticos", module: "ai_reports" },
  ],
};
const adminAlerts: NavSection = {
  label: "Alertas",
  icon: Bell,
  tabs: [
    { path: "/admin/alertas", label: "Todas las alertas", module: "alerts" },
    { path: "/admin/umbrales", label: "Umbrales", module: "alerts" },
  ],
};
const adminAssistant: NavSection = {
  label: "Asistente",
  icon: MessageCircle,
  tabs: [
    { path: "/admin/asistente-ia", label: "Preguntar", module: "ai_assistant" },
    { path: "/admin/reportes-ia", label: "Reportes automáticos", module: "ai_reports" },
    { path: "/admin/consumo-ia", label: "Consumo", module: "ai_assistant" },
  ],
};

const visibleTabs = (section: NavSection, modules: Modules) => section.tabs.filter((t) => !t.module || modules[t.module]);

/** Destino de menú de una sección: apunta a su primera pestaña visible; `null` si todos sus módulos están apagados. */
function sectionItem(section: NavSection, modules: Modules): NavItem | null {
  const tabs = visibleTabs(section, modules);
  if (tabs.length === 0) return null;
  return {
    path: tabs[0].path,
    label: section.label,
    icon: section.icon,
    match: section.tabs.flatMap((t) => [t.path, ...(t.match ?? [])]),
  };
}

const clientCore = {
  predios: { path: "/cliente", icon: Warehouse, label: "Mis predios", exact: true, match: ["/cliente/area", "/cliente/areas", "/cliente/predio", "/cliente/historico", "/cliente/exportar"] } as NavItem,
  mapa: { path: "/cliente/mapa", icon: MapPin, label: "Mapa" } as NavItem,
  cuenta: { path: "/cliente/perfil", icon: User, label: "Cuenta" } as NavItem,
};
const adminCore = {
  hoy: { path: "/admin", icon: Home, label: "Inicio", exact: true } as NavItem,
  clientes: { path: "/admin/clientes", icon: Users, label: "Clientes", match: ["/admin/predios", "/admin/areas", "/admin/ciclos"] } as NavItem,
  red: { path: "/admin/gateways", icon: Network, label: "Red", match: ["/admin/nodos", "/admin/mapa"] } as NavItem,
  ajustes: { path: "/admin/cultivos", icon: Sprout, label: "Ajustes", match: ["/admin/auditoria"] } as NavItem,
};

/**
 * Ítems del menú para el rol, sin los módulos apagados. Las rutas siguen
 * existiendo: solo se quitan del menú.
 */
export function navItemsFor(role: "client" | "admin", modules: Modules): NavItem[] {
  const present = (item: NavItem | null): item is NavItem => item !== null;
  if (role === "client") {
    return [clientCore.predios, clientCore.mapa, sectionItem(clientAlerts, modules), sectionItem(clientAssistant, modules), clientCore.cuenta].filter(present);
  }
  return [adminCore.hoy, adminCore.clientes, adminCore.red, sectionItem(adminAlerts, modules), sectionItem(adminAssistant, modules), adminCore.ajustes].filter(present);
}

const trim = (path: string) => path.replace(/\/+$/, "") || "/";

/** ¿Es este destino el actual para la ruta dada? */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  const current = trim(pathname);
  const own = trim(item.path);
  if (current === own) return true;
  if (item.exact) return (item.match ?? []).some((prefix) => current === trim(prefix) || current.startsWith(`${trim(prefix)}/`));
  return [own, ...(item.match ?? [])].some((prefix) => current.startsWith(`${trim(prefix)}/`) || current === trim(prefix));
}

/** Pestañas internas de las secciones del admin, para llegar a pantallas hermanas (incluido Ciclos, que no tenía enlace). */
const adminSections: { when: string[]; tabs: SectionTab[] }[] = [
  { when: ["/admin/clientes", "/admin/predios", "/admin/areas", "/admin/ciclos"], tabs: [
    { path: "/admin/clientes", label: "Clientes", match: ["/admin/predios", "/admin/areas"] },
    { path: "/admin/ciclos", label: "Ciclos de cultivo" },
  ] },
  { when: ["/admin/gateways", "/admin/nodos", "/admin/mapa"], tabs: [
    { path: "/admin/gateways", label: "Equipos" },
    { path: "/admin/nodos", label: "Nodos" },
    { path: "/admin/mapa", label: "Mapa" },
  ] },
  { when: ["/admin/cultivos", "/admin/auditoria"], tabs: [
    { path: "/admin/cultivos", label: "Catálogo de cultivos" },
    { path: "/admin/auditoria", label: "Registro de eventos" },
  ] },
];

/** Secciones de Fase 2 con pestañas (productor y admin). */
const phase2Sections: NavSection[] = [clientAlerts, clientAssistant, adminAlerts, adminAssistant];

/**
 * Pestañas de la sección a la que pertenece la ruta, o `null` si no hay (o si queda una sola pestaña visible:
 * entonces no se muestra la barra).
 */
export function sectionTabsFor(pathname: string, modules: Modules = MODULES_OFF): SectionTab[] | null {
  const current = trim(pathname);
  const inside = (paths: string[]) => paths.some((w) => current === trim(w) || current.startsWith(`${trim(w)}/`));
  const admin = adminSections.find((s) => inside(s.when));
  if (admin) return admin.tabs;
  const section = phase2Sections.find((sec) => inside(sec.tabs.flatMap((t) => [t.path, ...(t.match ?? [])])));
  if (!section) return null;
  const tabs = visibleTabs(section, modules);
  return tabs.length > 1 ? tabs : null;
}

export function isSectionTabActive(tab: SectionTab, pathname: string): boolean {
  const current = trim(pathname);
  return [tab.path, ...(tab.match ?? [])].some((p) => current === trim(p) || current.startsWith(`${trim(p)}/`));
}
