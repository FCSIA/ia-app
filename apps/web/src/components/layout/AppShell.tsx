"use client";

import {
  Fragment,
  useCallback,
  useEffect,
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

export type { ChannelSearchControl } from "@/components/layout/app-shell-header";

export function AppShell({
  children,
  headerSlot,
  mainClassName,
  pageTransitionClassName,
  channelSearch,
  onMobileSwipeRight,
}: {
  children: ReactNode;
  headerSlot?: ReactNode;
  mainClassName?: string;
  pageTransitionClassName?: string;
  channelSearch?: ChannelSearchControl;
  onMobileSwipeRight?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandHint, setCommandHint] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>("everything");
  const navigationLoading = useNavigationLoadingOptional();
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
        className="app-root flex min-h-[100dvh] w-full bg-background"
        {...swipeHandlers}
      >
        {/* z-40 keeps hover labels above the adjacent workspace sidebar. */}
        <AppShellDesktopNavigation {...navigationProps} />
        <AppShellMobileNavigation
          {...navigationProps}
          open={mobileOpen}
          onOpenChange={setMobileOpen}
        />

        <div className="app-main-surface flex min-h-0 min-w-0 flex-1 flex-col bg-card pb-[env(safe-area-inset-bottom)]">
          <AppShellHeader
            headerSlot={headerSlot}
            channelSearch={channelSearch}
            searchScope={searchScope}
            commandHint={commandHint}
            user={user}
            onOpenMobileNavigation={() => setMobileOpen(true)}
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
