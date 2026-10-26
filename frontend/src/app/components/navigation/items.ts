import {
  Activity,
  Bell,
  BellRing,
  Bot,
  ClipboardList,
  Clock,
  Download,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Router,
  Radio,
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
  /** Label corto usado en la barra de tabs móvil; cae a `label` si no existe. */
  mobileLabel?: string;
  /** Módulo opcional (Fase 2) del que depende; el ítem se oculta del menú si está apagado. */
  module?: ModuleKey;
}

const clientNavItems: NavItem[] = [
  { path: "/cliente",                icon: LayoutDashboard,  label: "Dashboard",      mobileLabel: "Inicio" },
  { path: "/cliente/areas",          icon: Warehouse,        label: "Predios" },
  { path: "/cliente/mapa",           icon: MapPin,           label: "Mapa" },
  { path: "/cliente/historico",      icon: Clock,            label: "Histórico" },
  { path: "/cliente/exportar",       icon: Download,         label: "Exportar" },
  { path: "/cliente/alertas",        icon: Bell,             label: "Alertas",        module: "alerts" },
  { path: "/cliente/asistente-ia",   icon: MessageCircle,    label: "Asistente IA",   mobileLabel: "Chat IA", module: "ai_assistant" },
  { path: "/cliente/reportes-ia",    icon: Bot,              label: "Reportes IA",    mobileLabel: "IA", module: "ai_reports" },
  { path: "/cliente/umbrales",       icon: SlidersHorizontal, label: "Umbrales",      module: "alerts" },
  { path: "/cliente/notificaciones", icon: BellRing,         label: "Notificaciones", mobileLabel: "Notifs", module: "notifications" },
  { path: "/cliente/perfil",         icon: User,             label: "Perfil" },
];

const adminNavItems: NavItem[] = [
  { path: "/admin",           icon: LayoutDashboard,  label: "Dashboard",    mobileLabel: "Inicio" },
  { path: "/admin/clientes",  icon: Users,            label: "Clientes" },
  { path: "/admin/mapa",      icon: MapPin,           label: "Mapa" },
  { path: "/admin/nodos",     icon: Radio,            label: "Nodos" },
  { path: "/admin/gateways",  icon: Router,           label: "Equipos" },
  { path: "/admin/cultivos",  icon: Sprout,           label: "Catálogo" },
  { path: "/admin/umbrales",  icon: SlidersHorizontal, label: "Umbrales",    module: "alerts" },
  { path: "/admin/alertas",   icon: Bell,             label: "Alertas",      module: "alerts" },
  { path: "/admin/asistente-ia", icon: MessageCircle, label: "Asistente IA", mobileLabel: "Chat IA", module: "ai_assistant" },
  { path: "/admin/consumo-ia", icon: Activity,        label: "Consumo IA",   mobileLabel: "Uso IA", module: "ai_assistant" },
  { path: "/admin/reportes-ia", icon: Bot,            label: "Reportes IA",  mobileLabel: "IA", module: "ai_reports" },
  { path: "/admin/auditoria", icon: ClipboardList,    label: "Auditoría" },
];

/**
 * Ítems del menú para el rol, sin los módulos apagados. Las rutas siguen
 * existiendo: solo se quitan del menú.
 */
export function navItemsFor(role: "client" | "admin", modules: Modules): NavItem[] {
  const items = role === "client" ? clientNavItems : adminNavItems;
  return items.filter((item) => !item.module || modules[item.module]);
}