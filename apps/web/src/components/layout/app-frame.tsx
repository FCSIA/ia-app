"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@/lib/convex-react";
import { api } from "~/apps/convex/src/_generated/api";
import { hasRole, useCurrentUser } from "@/lib/auth";
import { computeWrappedAvailability } from "@/lib/wrapped";
import { GlobalCommandPalette } from "@/components/layout/GlobalCommandPalette";
import { CommandMenuDialogRoot } from "@/components/ui/command-menu";
import {
  AppShellDesktopNavigation,
  AppShellMobileNavigation,
  AppShellMobileTabBar,
} from "@/components/layout/app-shell-navigation";
import {
  AppFrameActionsProvider,
  type AppFrameRouteConfig,
} from "@/components/layout/app-frame-context";
import { useMobileNavigationSwipe } from "@/components/layout/use-mobile-navigation-swipe";
import { ImpersonationBanner } from "@/components/auth/impersonation-banner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getFixedBottomViewportOffset } from "@/components/layout/visual-viewport";
import { cn } from "@/lib/utils";

const SHELLLESS_ROUTES = new Set(["/", "/login", "/logout", "/change-password", "/wrapped"]);

type Registration = { owner: symbol; config: AppFrameRouteConfig };

/** Lives in the root provider tree: route changes replace only the inset's
 * children, never the main sidebar, its provider, or the inset element. */
export function AppFrame({ children, defaultSidebarOpen }: {
  children: ReactNode;
  defaultSidebarOpen: boolean;
}) {
  const pathname = usePathname() ?? "/dashboard";
  const isFramedPage = !SHELLLESS_ROUTES.has(pathname);
  return isFramedPage ? (
    <PersistentAppFrame defaultSidebarOpen={defaultSidebarOpen}>{children}</PersistentAppFrame>
  ) : children;
}

function PersistentAppFrame({ children, defaultSidebarOpen }: {
  children: ReactNode;
  defaultSidebarOpen: boolean;
}) {
  const pathname = usePathname();
  const user = useCurrentUser();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandHint, setCommandHint] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const appRootRef = useRef<HTMLDivElement>(null);
  const mobileTabBarRef = useRef<HTMLElement>(null);
  const safePathname = pathname ?? "/dashboard";
  const routeConfig = registration?.config.pathname === safePathname ? registration.config : null;
  const viewportMode = routeConfig?.viewportMode ?? "document";
  const usesVisualViewport = viewportMode === "visual";
  useMobileNavigationSwipe(appRootRef, routeConfig?.onMobileSwipeRight, routeConfig?.mobileNavigationSwipeOptions);

  const register = useCallback((owner: symbol, config: AppFrameRouteConfig) => {
    setRegistration((current) => {
      if (current?.owner === owner &&
          current.config.pathname === config.pathname &&
          current.config.scheduleTab === config.scheduleTab &&
          current.config.scheduleSection === config.scheduleSection &&
          current.config.pageNavigation === config.pageNavigation &&
          current.config.viewportMode === config.viewportMode &&
          current.config.onMobileSwipeRight === config.onMobileSwipeRight &&
          current.config.mobileNavigationSwipeOptions?.onProgress === config.mobileNavigationSwipeOptions?.onProgress &&
          current.config.mobileNavigationSwipeOptions?.onCancel === config.mobileNavigationSwipeOptions?.onCancel) return current;
      return { owner, config };
    });
  }, []);
  const unregister = useCallback((owner: symbol) => {
    setRegistration((current) => current?.owner === owner ? null : current);
  }, []);
  const openGlobalSearch = useCallback(() => setCommandOpen(true), []);
  const actions = useMemo(() => ({ register, unregister, openGlobalSearch }), [register, unregister, openGlobalSearch]);

  useEffect(() => {
    setCommandHint(/Mac|iPhone|iPad|iPod/i.test(navigator.platform));
  }, []);

  useEffect(() => {
    const onOpenGlobalSearch = () => setCommandOpen(true);
    window.addEventListener("ia:open-global-search", onOpenGlobalSearch);
    return () => {
      window.removeEventListener("ia:open-global-search", onOpenGlobalSearch);
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [safePathname]);

  useEffect(() => {
    if (!usesVisualViewport) return;

    const root = appRootRef.current;
    if (!root) return;

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const viewport = window.visualViewport;

    const syncHeight = () => {
      const height = viewport?.height ?? window.innerHeight;
      root.style.setProperty("--app-visual-viewport-height", `${Math.round(height)}px`);

      // Focusing the composer can make WebKit pan the layout viewport before
      // the visual viewport resize arrives. The bounded shell owns no document
      // scrolling, so return that transient pan to the message scrollport.
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    syncHeight();
    viewport?.addEventListener("resize", syncHeight);
    viewport?.addEventListener("scroll", syncHeight);
    window.addEventListener("resize", syncHeight);

    return () => {
      viewport?.removeEventListener("resize", syncHeight);
      viewport?.removeEventListener("scroll", syncHeight);
      window.removeEventListener("resize", syncHeight);
      root.style.removeProperty("--app-visual-viewport-height");
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [usesVisualViewport]);

  useEffect(() => {
    const tabBar = mobileTabBarRef.current;
    const compactViewport = window.matchMedia("(max-width: 1023px)");
    if (!tabBar) return;

    let frame: number | null = null;
    const syncTabBar = () => {
      if (!compactViewport.matches) {
        tabBar.style.removeProperty("--app-mobile-tabbar-viewport-offset");
        return;
      }

      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Always measure the uncorrected fixed position. Otherwise a previous
        // correction becomes part of the next measurement and compounds.
        tabBar.style.setProperty("--app-mobile-tabbar-viewport-offset", "0px");
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const offset = getFixedBottomViewportOffset({
          elementBottom: tabBar.getBoundingClientRect().bottom,
          elementHeight: tabBar.getBoundingClientRect().height,
          viewportHeight,
        });
        tabBar.style.setProperty("--app-mobile-tabbar-viewport-offset", `${offset}px`);
        frame = null;
      });
    };

    syncTabBar();
    window.visualViewport?.addEventListener("resize", syncTabBar);
    window.visualViewport?.addEventListener("scroll", syncTabBar);
    window.addEventListener("resize", syncTabBar);
    window.addEventListener("orientationchange", syncTabBar);
    window.addEventListener("pageshow", syncTabBar);
    compactViewport.addEventListener("change", syncTabBar);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener("resize", syncTabBar);
      window.visualViewport?.removeEventListener("scroll", syncTabBar);
      window.removeEventListener("resize", syncTabBar);
      window.removeEventListener("orientationchange", syncTabBar);
      window.removeEventListener("pageshow", syncTabBar);
      compactViewport.removeEventListener("change", syncTabBar);
      tabBar.style.removeProperty("--app-mobile-tabbar-viewport-offset");
    };
  }, []);

  const unreadData = useQuery(api.notifications.inbox.unreadCount);

  const showAdmin = Boolean(
    user && (hasRole(user, "ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF") || user.canReviewFeedback),
  );
  const showSchedule = Boolean(
    user && hasRole(user, "STUDENT", "ADMIN", "SUPER_ADMIN"),
  );
  // Wrapped only appears in the nav during its May window. Admins can still
  // navigate directly when they need to preview it outside that window.
  const showWrapped = computeWrappedAvailability().open;
  const unreadBadge = unreadData?.count
    ? unreadData.count > 9
      ? "9+"
      : String(unreadData.count)
    : undefined;
  const navigationProps = {
    pathname: safePathname,
    unreadBadge,
    showAdmin,
    showSchedule,
    showFriends: Boolean(user && hasRole(user, "STUDENT")),
    showDayPlans: Boolean(user && hasRole(user, "ADMIN", "SUPER_ADMIN")),
    scheduleTab: routeConfig?.scheduleTab,
    scheduleSection: routeConfig?.scheduleSection,
    pageNavigation: routeConfig?.pageNavigation,
    showWrapped,
    mobileTabLayout: user?.mobileTabLayout,
  };

  return (
    <AppFrameActionsProvider value={actions}>
      <CommandMenuDialogRoot open={commandOpen} onOpenChange={setCommandOpen}>
        <SidebarProvider
          ref={appRootRef}
          mobileBreakpoint={1024}
          peek="click"
          defaultOpen={defaultSidebarOpen}
          persist
          data-viewport-mode={viewportMode}
          className={cn(
            "app-root flex w-full bg-background",
            usesVisualViewport
              ? "fixed inset-x-0 top-0 h-[var(--app-visual-viewport-height,100dvh)] min-h-0 overflow-hidden overscroll-none"
              : "min-h-[100dvh]",
          )}
        >
          <AppShellDesktopNavigation {...navigationProps} commandHint={commandHint} />
          <AppShellMobileNavigation {...navigationProps} open={mobileOpen} onOpenChange={setMobileOpen} />
          <SidebarInset className={cn(
            "app-main-surface overflow-clip pb-[calc(3rem+max(1rem,env(safe-area-inset-bottom)))] lg:pb-0",
            usesVisualViewport && "overflow-hidden",
          )}>
            {children}
          </SidebarInset>
          <AppShellMobileTabBar {...navigationProps} tabBarRef={mobileTabBarRef} onOpenMenu={() => setMobileOpen(true)} />
        </SidebarProvider>
        <GlobalCommandPalette user={user} open={commandOpen} />
        <ImpersonationBanner />
      </CommandMenuDialogRoot>
    </AppFrameActionsProvider>
  );
}
