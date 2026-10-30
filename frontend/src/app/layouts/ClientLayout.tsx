import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { DesktopSidebar } from "../components/navigation/DesktopSidebar";
import { MobileTabBar } from "../components/navigation/MobileTabBar";
import { SkipLink } from "../components/navigation/SkipLink";
import { AlertsPopover } from "../components/notifications/AlertsPopover";
import { SelectionProvider } from "../context/SelectionContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { useModules } from "../hooks/useModules";

export function ClientLayout() {
  const isMobile = useIsMobile();
  const alertsEnabled = useModules().alerts;
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Scroll to top on route change
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  return (
    <SelectionProvider persistenceKey="client">
      <div
        className={`bg-background flex overflow-x-hidden transition-colors duration-300 ${
          isMobile ? "min-h-screen" : "h-screen overflow-hidden"
        }`}
      >
        <SkipLink targetRef={mainRef} />
        {!isMobile && <DesktopSidebar role="client" />}

        <main
          id="contenido"
          ref={mainRef}
          tabIndex={-1}
          className={`flex-1 min-w-0 overflow-x-hidden focus:outline-none bg-[var(--surface-page)] ${isMobile ? "pb-20" : "h-screen overflow-y-auto"
            }`}
        >
          <Outlet />
        </main>

        {alertsEnabled && (
          <AlertsPopover className={isMobile ? "fixed top-3 right-3 z-40" : "fixed top-4 right-6 z-40"} />
        )}

        {isMobile && <MobileTabBar role="client" />}
      </div>
    </SelectionProvider>
  );
}
