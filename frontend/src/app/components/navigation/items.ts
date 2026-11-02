import {
  Bell,
  BellRing,
  Bot,
  Home,
  MapPin,
  MessageCircle,
  Network,
  Settings,
  SlidersHorizontal,
  Sprout,
  User,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { ModuleKey, Modules } from "../../services/modules";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Label corto usado en la barra de pestañas móvil; cae a `label` si no existe. */
  mobileLabel?: string;
  /** Módulo opcional (Fase 2) del que depende; el ítem se oculta del menú si está apagado. */
  module?: ModuleKey;
  /** Prefijos de ruta que también marcan este destino como actual (la ruta de `path` siempre cuenta). */
  match?: string[];
  /** Solo es actual con la ruta exacta (portadas: `/cliente`, `/admin`). */
  exact?: boolean;
}

/**
 * Navegación por cosas, no por herramientas (docs/redesign/v2/02-arquitectura.md).
 * Cada destino aterriza en la pantalla actual más cercana; las fases 2 a 6 las reemplazan.
 * Las rutas antiguas siguen existiendo, así que ninguna función queda sin acceso.
 */
const clientNavItems: NavItem[] = [
  { path: "/cliente",                icon: Warehouse,         label: "Mis predios",    exact: true, match: ["/cliente/area", "/cliente/areas", "/cliente/predio", "/cliente/historico", "/cliente/exportar"] },
  { path: "/cliente/mapa",           icon: MapPin,            label: "Mapa" },
  { path: "/cliente/alertas",        icon: Bell,              label: "Alertas",        module: "alerts" },
  { path: "/cliente/asistente-ia",   icon: MessageCircle,     label: "Asistente IA",   mobileLabel: "Chat IA", module: "ai_assistant" },
  { path: "/cliente/reportes-ia",    icon: Bot,               label: "Reportes IA",    mobileLabel: "IA", module: "ai_reports" },
  { path: "/cliente/umbrales",       icon: SlidersHorizontal, label: "Umbrales",       module: "alerts" },
  { path: "/cliente/notificaciones", icon: BellRing,          label: "Notificaciones", mobileLabel: "Notifs", module: "notifications" },
  { path: "/cliente/perfil",         icon: User,              label: "Cuenta" },
];

const adminNavItems: NavItem[] = [
  { path: "/admin",           icon: Home,              label: "Hoy",      exact: true },
  { path: "/admin/clientes",  icon: Users,             label: "Clientes", match: ["/admin/predios", "/admin/areas", "/admin/ciclos"] },
  { path: "/admin/gateways",  icon: Network,           label: "Red",      match: ["/admin/nodos", "/admin/mapa"] },
  { path: "/admin/cultivos",  icon: Sprout,            label: "Ajustes",  match: ["/admin/auditoria"] },
  { path: "/admin/umbrales",  icon: SlidersHorizontal, label: "Umbrales",     module: "alerts" },
  { path: "/admin/alertas",   icon: Bell,              label: "Alertas",      module: "alerts" },
  { path: "/admin/asistente-ia", icon: MessageCircle,  label: "Asistente IA", mobileLabel: "Chat IA", module: "ai_assistant" },
  { path: "/admin/consumo-ia", icon: Settings,         label: "Consumo IA",   mobileLabel: "Uso IA", module: "ai_assistant" },
  { path: "/admin/reportes-ia", icon: Bot,             label: "Reportes IA",  mobileLabel: "IA", module: "ai_reports" },
];

/**
 * Ítems del menú para el rol, sin los módulos apagados. Las rutas siguen
 * existiendo: solo se quitan del menú.
 */
export function navItemsFor(role: "client" | "admin", modules: Modules): NavItem[] {
  const items = role === "client" ? clientNavItems : adminNavItems;
  return items.filter((item) => !item.module || modules[item.module]);
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

export interface SectionTab {
  path: string;
  label: string;
  /** Prefijos de ruta que marcan esta pestaña como actual. */
  match?: string[];
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

/** Pestañas de la sección a la que pertenece la ruta, o `null` si no hay. */
export function sectionTabsFor(pathname: string): SectionTab[] | null {
  const current = trim(pathname);
  return adminSections.find((s) => s.when.some((w) => current === w || current.startsWith(`${w}/`)))?.tabs ?? null;
}

export function isSectionTabActive(tab: SectionTab, pathname: string): boolean {
  const current = trim(pathname);
  return [tab.path, ...(tab.match ?? [])].some((p) => current === trim(p) || current.startsWith(`${trim(p)}/`));
}
