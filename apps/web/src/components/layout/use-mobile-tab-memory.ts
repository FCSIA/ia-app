"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import type { MobileTabId } from "./app-shell-navigation";

const ROOT_BY_TAB: Record<MobileTabId, string> = {
  announcements: "/announcements",
  clubs: "/clubs",
  schedule: "/schedule",
  calendar: "/calendar",
  events: "/events",
  "flex-friday": "/flex-friday",
  wrapped: "/wrapped",
};

const DASHBOARD_KEY = "ia:mobile-last:dashboard";

function tabIdForPathname(pathname: string): MobileTabId | "dashboard" | null {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname.startsWith("/dashboard?")) return "dashboard";
  for (const [id, root] of Object.entries(ROOT_BY_TAB) as Array<[MobileTabId, string]>) {
    if (pathname === root || pathname.startsWith(`${root}/`) || pathname.startsWith(`${root}?`)) return id;
  }
  return null;
}

function storageKey(tabId: MobileTabId) {
  return `ia:mobile-last:${tabId}`;
}

function readStored(tabId: MobileTabId | "dashboard"): string | null {
  try {
    const key = tabId === "dashboard" ? DASHBOARD_KEY : storageKey(tabId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const root = tabId === "dashboard" ? "/dashboard" : ROOT_BY_TAB[tabId];
    if (raw !== root && !raw.startsWith(`${root}/`) && !raw.startsWith(`${root}?`) ) return null;
    return raw;
  } catch {
    return null;
  }
}

export function useMobileTabMemory() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fullPath = useMemo(() => {
    const base = pathname ?? "";
    const qs = searchParams?.toString();
    return qs ? `${base}?${qs}` : base;
  }, [pathname, searchParams]);

  const [lastByTab, setLastByTab] = useState<Partial<Record<MobileTabId | "dashboard", string>>>({});

  // Hydrate from localStorage on mount
  useEffect(() => {
    const next: Partial<Record<MobileTabId | "dashboard", string>> = {};
    for (const tabId of Object.keys(ROOT_BY_TAB) as MobileTabId[]) {
      const stored = readStored(tabId);
      if (stored) next[tabId] = stored;
    }
    const dash = readStored("dashboard");
    if (dash) next["dashboard"] = dash;
    setLastByTab(next);
  }, []);

  // Persist current location as last for its tab
  useEffect(() => {
    if (!pathname) return;
    const tabId = tabIdForPathname(pathname);
    if (!tabId) return;
    const key = tabId === "dashboard" ? DASHBOARD_KEY : storageKey(tabId as MobileTabId);
    try {
      window.localStorage.setItem(key, fullPath);
    } catch {}
    setLastByTab((prev) => (prev[tabId] === fullPath ? prev : { ...prev, [tabId]: fullPath }));
  }, [pathname, fullPath]);

  const getHref = (tabId: MobileTabId | undefined, fallbackHref: string) => {
    if (fallbackHref === "/dashboard") return (lastByTab["dashboard"] as string | undefined) ?? fallbackHref;
    if (!tabId) return fallbackHref;
    return (lastByTab[tabId] as string | undefined) ?? fallbackHref;
  };

  return { lastByTab, getHref };
}
