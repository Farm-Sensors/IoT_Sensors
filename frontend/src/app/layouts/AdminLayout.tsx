import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { DesktopSidebar } from "../components/navigation/DesktopSidebar";
import { MobileHeader } from "../components/navigation/MobileHeader";
import { MobileTabBar } from "../components/navigation/MobileTabBar";
import { ModuleOffNotice } from "../components/navigation/ModuleOffNotice";
import { SectionTabs } from "../components/navigation/SectionTabs";
import { SkipLink } from "../components/navigation/SkipLink";
import { AlertsPopover } from "../components/notifications/AlertsPopover";
import { SelectionProvider } from "../context/SelectionContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { useModules } from "../hooks/useModules";

export function AdminLayout() {
  const isMobile = useIsMobile();
  const alertsEnabled = useModules().alerts;
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Scroll to top on route change
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  return (
    <SelectionProvider autoSelectFirst={false} persistenceKey="admin">
      <div
        className={`bg-background flex overflow-x-hidden transition-colors duration-300 ${
          isMobile ? "min-h-screen flex-col" : "h-screen overflow-hidden"
        }`}
      >
        <SkipLink targetRef={mainRef} />
        {!isMobile && <DesktopSidebar role="admin" />}
        {isMobile && <MobileHeader role="admin" />}

        <main
          id="contenido"
          ref={mainRef}
          tabIndex={-1}
          className={`flex-1 min-w-0 overflow-x-hidden focus:outline-none bg-[var(--surface-page)] ${isMobile ? "pb-24" : "h-screen overflow-y-auto"
            }`}
        >
          <SectionTabs />
          <ModuleOffNotice />
          <Outlet />
        </main>

        {alertsEnabled && (
          <AlertsPopover className={isMobile ? "fixed top-1.5 right-16 z-50" : "fixed top-4 right-6 z-40"} />
        )}

        {isMobile && <MobileTabBar role="admin" />}
      </div>
    </SelectionProvider>
  );
}
