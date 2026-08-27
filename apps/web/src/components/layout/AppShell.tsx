"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";

import { api } from "~/apps/convex/src/_generated/api";
import { hasRole, startLogout, useCurrentUser } from "@/lib/auth";
import { computeWrappedAvailability } from "@/lib/wrapped";
import { GlobalCommandPalette } from "@/components/layout/GlobalCommandPalette";
import {
  AppShellDesktopNavigation,
  AppShellMobileNavigation,
  AppShellMobileTabBar,
} from "@/components/layout/app-shell-navigation";
import {
  AppShellHeader,
  type ChannelSearchControl,
  type SearchScope,
} from "@/components/layout/app-shell-header";
import { useMobileNavigationSwipe } from "@/components/layout/use-mobile-navigation-swipe";
import { useNavigationLoadingOptional } from "@/components/layout/navigation-loading-provider";
import { PageTransition } from "@/components/layout/page-transition";
import { ImpersonationBanner } from "@/components/auth/impersonation-banner";
import { cn } from "@/lib/utils";

export type { ChannelSearchControl } from "@/components/layout/app-shell-header";

export function AppShell({
  children,
  headerSlot,
  mainClassName,
  pageTransitionClassName,
  channelSearch,
  onMobileSwipeRight,
  viewportMode = "document",
}: {
  children: ReactNode;
  headerSlot?: ReactNode;
  mainClassName?: string;
  pageTransitionClassName?: string;
  channelSearch?: ChannelSearchControl;
  onMobileSwipeRight?: () => void;
  viewportMode?: "document" | "visual";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandHint, setCommandHint] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>("everything");
  const navigationLoading = useNavigationLoadingOptional();
  const appRootRef = useRef<HTMLDivElement>(null);
  const usesVisualViewport = viewportMode === "visual";
  const safePathname = pathname ?? "/dashboard";
  const openMobileNavigation = useCallback(() => {
    if (onMobileSwipeRight) {
      onMobileSwipeRight();
      return;
    }
    setMobileOpen(true);
  }, [onMobileSwipeRight]);
  const swipeHandlers = useMobileNavigationSwipe(openMobileNavigation);

  useEffect(() => {
    setCommandHint(/Mac|iPhone|iPad|iPod/i.test(navigator.platform));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
    };
    const onOpenGlobalSearch = () => setCommandOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("ia:open-global-search", onOpenGlobalSearch);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
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

  const unreadData = useQuery(api.notifications.inbox.unreadCount);

  const handleLogout = () => {
    startLogout();
  };

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
    showWrapped,
  };

  const toggleSearchScope = () => {
    channelSearch?.onValueChange("");
    setSearchScope((current) =>
      current === "everything" ? "channel" : "everything",
    );
  };

  return (
    <Fragment>
      <div
        ref={appRootRef}
        data-viewport-mode={viewportMode}
        className={cn(
          "app-root flex w-full bg-background",
          usesVisualViewport
            ? "h-[var(--app-visual-viewport-height,100dvh)] min-h-0 overflow-hidden overscroll-none"
            : "min-h-[100dvh]",
        )}
        {...swipeHandlers}
      >
        {/* z-40 keeps hover labels above the adjacent workspace sidebar. */}
        <AppShellDesktopNavigation {...navigationProps} />
        <AppShellMobileNavigation
          {...navigationProps}
          open={mobileOpen}
          onOpenChange={setMobileOpen}
        />

        <div
          className={cn(
            "app-main-surface flex min-h-0 min-w-0 flex-1 flex-col bg-card pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0",
            usesVisualViewport && "h-full overflow-hidden",
          )}
        >
          <AppShellHeader
            headerSlot={headerSlot}
            channelSearch={channelSearch}
            searchScope={searchScope}
            commandHint={commandHint}
            user={user}
            onOpenGlobalSearch={() => setCommandOpen(true)}
            onToggleSearchScope={toggleSearchScope}
            onOpenProfile={() => {
              navigationLoading?.startNavigation("/profile");
              router.push("/profile");
            }}
            onLogout={handleLogout}
          />

          <main
            className={
              mainClassName ?? "flex-1 px-4 pb-8 pt-6 md:px-6 md:pt-8 lg:px-8"
            }
          >
            <PageTransition className={pageTransitionClassName}>
              {children}
            </PageTransition>
          </main>
        </div>
        <AppShellMobileTabBar
          {...navigationProps}
          onOpenMenu={() => setMobileOpen(true)}
        />
      </div>
      <GlobalCommandPalette
        user={user}
        open={commandOpen}
        onOpenChange={setCommandOpen}
      />
      <ImpersonationBanner />
    </Fragment>
  );
}
