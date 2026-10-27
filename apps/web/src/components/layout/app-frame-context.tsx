"use client";

import { createContext, use, type ReactNode } from "react";
import type { AppPageNavigation } from "@/components/layout/app-shell-navigation";
import type { MobileNavigationSwipeOptions } from "@/components/layout/use-mobile-navigation-swipe";

export type AppFrameRouteConfig = {
  pathname: string;
  scheduleTab?: string;
  scheduleSection?: string;
  pageNavigation?: AppPageNavigation;
  viewportMode: "document" | "visual";
  onMobileSwipeRight?: () => void;
  mobileNavigationSwipeOptions?: MobileNavigationSwipeOptions;
};

export type AppFrameActions = {
  register: (owner: symbol, config: AppFrameRouteConfig) => void;
  unregister: (owner: symbol) => void;
  openGlobalSearch: () => void;
};

// Registrars must not read the configuration they write. Keeping the action
// channel stable also lets route-owned inline navigation arrays update without
// making the shell and its page repeatedly update one another.
const AppFrameActionsContext = createContext<AppFrameActions | null>(null);

export function AppFrameActionsProvider({
  value,
  children,
}: {
  value: AppFrameActions;
  children: ReactNode;
}) {
  return (
    <AppFrameActionsContext.Provider value={value}>
      {children}
    </AppFrameActionsContext.Provider>
  );
}

export function useAppFrameActions() {
  const actions = use(AppFrameActionsContext);
  if (!actions) throw new Error("AppShell must be rendered inside AppFrame");
  return actions;
}
