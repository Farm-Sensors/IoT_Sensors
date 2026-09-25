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

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Label corto usado en la barra de tabs móvil; cae a `label` si no existe. */
  mobileLabel?: string;
}

export const clientNavItems: NavItem[] = [
  { path: "/cliente",                icon: LayoutDashboard,  label: "Dashboard",      mobileLabel: "Inicio" },
  { path: "/cliente/areas",          icon: Warehouse,        label: "Predios" },
  { path: "/cliente/mapa",           icon: MapPin,           label: "Mapa" },
  { path: "/cliente/historico",      icon: Clock,            label: "Histórico" },
  { path: "/cliente/exportar",       icon: Download,         label: "Exportar" },
  { path: "/cliente/alertas",        icon: Bell,             label: "Alertas" },
  { path: "/cliente/asistente-ia",   icon: MessageCircle,    label: "Asistente IA",   mobileLabel: "Chat IA" },
  { path: "/cliente/reportes-ia",    icon: Bot,              label: "Reportes IA",    mobileLabel: "IA" },
  { path: "/cliente/umbrales",       icon: SlidersHorizontal, label: "Umbrales" },
  { path: "/cliente/notificaciones", icon: BellRing,         label: "Notificaciones", mobileLabel: "Notifs" },
  { path: "/cliente/perfil",         icon: User,             label: "Perfil" },
];

export const adminNavItems: NavItem[] = [
  { path: "/admin",           icon: LayoutDashboard,  label: "Dashboard",    mobileLabel: "Inicio" },
  { path: "/admin/clientes",  icon: Users,            label: "Clientes" },
  { path: "/admin/mapa",      icon: MapPin,           label: "Mapa" },
  { path: "/admin/nodos",     icon: Radio,            label: "Nodos" },
  { path: "/admin/recorrido-v2", icon: ClipboardList, label: "Recorrido v2" },
  { path: "/admin/gateways",  icon: Router,           label: "Gateways" },
  { path: "/admin/cultivos",  icon: Sprout,           label: "Catálogo" },
  { path: "/admin/umbrales",  icon: SlidersHorizontal, label: "Umbrales" },
  { path: "/admin/alertas",   icon: Bell,             label: "Alertas" },
  { path: "/admin/asistente-ia", icon: MessageCircle, label: "Asistente IA", mobileLabel: "Chat IA" },
  { path: "/admin/consumo-ia", icon: Activity,        label: "Consumo IA",   mobileLabel: "Uso IA" },
  { path: "/admin/reportes-ia", icon: Bot,            label: "Reportes IA",  mobileLabel: "IA" },
  { path: "/admin/auditoria", icon: ClipboardList,    label: "Auditoría" },
];