"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { startLogout, useCurrentUser } from "@/lib/auth";
import { useAppFrameActions } from "@/components/layout/app-frame-context";
import type { AppPageNavigation } from "@/components/layout/app-shell-navigation";
import {
  AppShellHeader,
  type ChannelSearchControl,
  type SearchScope,
} from "@/components/layout/app-shell-header";
import type { MobileNavigationSwipeOptions } from "@/components/layout/use-mobile-navigation-swipe";
import { useNavigationLoadingOptional } from "@/components/layout/navigation-loading-provider";
import { PageTransition } from "@/components/layout/page-transition";
import { SidebarTrigger } from "@/components/ui/sidebar";

export type { ChannelSearchControl } from "@/components/layout/app-shell-header";
export type { AppPageNavigation } from "@/components/layout/app-shell-navigation";

export function AppShell({
  children,
  headerSlot,
  headerMode,
  bannerSlot,
  mainClassName,
  pageTransitionClassName,
  channelSearch,
  scheduleTab,
  scheduleSection,
  pageNavigation,
  onMobileSwipeRight,
  mobileNavigationSwipeOptions,
  viewportMode = "document",
}: {
  children: ReactNode;
  headerSlot?: ReactNode;
  headerMode?: "default" | "editing";
  /** Full-width notices below the header, outside page padding. */
  bannerSlot?: ReactNode;
  mainClassName?: string;
  pageTransitionClassName?: string;
  channelSearch?: ChannelSearchControl;
  scheduleTab?: string;
  scheduleSection?: string;
  pageNavigation?: AppPageNavigation;
  onMobileSwipeRight?: () => void;
  mobileNavigationSwipeOptions?: MobileNavigationSwipeOptions;
  viewportMode?: "document" | "visual";
}) {
  const pathname = usePathname() ?? "/dashboard";
  const router = useRouter();
  const user = useCurrentUser();
  const navigationLoading = useNavigationLoadingOptional();
  const { register, unregister, openGlobalSearch } = useAppFrameActions();
  const owner = useRef(Symbol("AppShell"));
  const [commandHint, setCommandHint] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>("everything");
  const onProgress = mobileNavigationSwipeOptions?.onProgress;
  const onCancel = mobileNavigationSwipeOptions?.onCancel;

  // Register before paint without moving children out of their feature's
  // React context. The root owns navigation DOM, while page headers, banners
  // and content retain their existing provider ancestry and event callbacks.
  useLayoutEffect(() => {
    register(owner.current, {
      pathname,
      scheduleTab,
      scheduleSection,
      pageNavigation,
      viewportMode,
      onMobileSwipeRight,
      mobileNavigationSwipeOptions:
        onProgress || onCancel ? { onProgress, onCancel } : undefined,
    });
  }, [register, pathname, scheduleTab, scheduleSection, pageNavigation, viewportMode, onMobileSwipeRight, onProgress, onCancel]);
  useLayoutEffect(() => {
    const token = owner.current;
    return () => unregister(token);
  }, [unregister]);

  useEffect(() => {
    setCommandHint(/Mac|iPhone|iPad|iPod/i.test(navigator.platform));
  }, []);
  useEffect(() => setSearchScope("everything"), [pathname]);

  const toggleSearchScope = () => {
    channelSearch?.onValueChange("");
    setSearchScope((current) => current === "everything" ? "channel" : "everything");
  };

  return (
    <Fragment>
      <div className="sticky top-0 z-20 shrink-0">
        <AppShellHeader
          mode={headerMode}
          globalSearchInSidebar
          headerSlot={
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <SidebarTrigger className="hidden shrink-0 lg:inline-flex" aria-label="Toggle main navigation" />
              {headerSlot}
            </div>
          }
          channelSearch={channelSearch}
          searchScope={searchScope}
          commandHint={commandHint}
          user={user}
          onOpenGlobalSearch={openGlobalSearch}
          onToggleSearchScope={toggleSearchScope}
          onOpenProfile={() => {
            navigationLoading?.startNavigation("/profile");
            router.push("/profile");
          }}
          onLogout={startLogout}
        />
        {bannerSlot}
      </div>

      <div
        className={
          mainClassName ?? "flex-1 px-4 pb-8 pt-6 md:px-6 md:pt-8 lg:px-8"
        }
      >
        <PageTransition className={pageTransitionClassName}>
          {children}
        </PageTransition>
      </div>
    </Fragment>
  );
}
