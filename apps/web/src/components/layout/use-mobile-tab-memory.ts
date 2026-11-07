"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { readStorage, writeStorage } from "@/lib/browser-storage";
import { isScheduleFriendsTab, isUnderPath, MOBILE_TAB_ROUTES, type MobileTabId } from "@/lib/routes";

type TabKey = MobileTabId | "dashboard";

const ROOT_BY_TAB = Object.fromEntries(
  MOBILE_TAB_ROUTES.map((route) => [route.id, route.path]),
) as Record<MobileTabId, string>;

function storageKey(tabId: TabKey) {
  return `ia:mobile-last:${tabId}`;
}

export function tabIdForPathname(pathname: string): TabKey | null {
  if (pathname === "/") return "dashboard";
  const route = MOBILE_TAB_ROUTES.find((candidate) => isUnderPath(pathname, candidate.path));
  return route?.id ?? null;
}

function isSocialSchedule(path: string) {
  const [, query] = path.split("?");
  return isScheduleFriendsTab(new URLSearchParams(query).get("tab"));
}

export function readStored(tabId: TabKey): string | null {
  const raw = readStorage(storageKey(tabId));
  if (!raw || (tabId === "schedule" && isSocialSchedule(raw))) return null;
  if (tabId === "dashboard") {
    // Migrate saved Home destinations without treating every route as Home.
    const home = raw.replace(/^\/(?:dashboard|home)(?=\?|$)/, "/");
    return home === "/" || home.startsWith("/?") ? home : null;
  }
  const root = ROOT_BY_TAB[tabId];
  return raw === root || raw.startsWith(`${root}/`) || raw.startsWith(`${root}?`) ? raw : null;
}

export function useMobileTabMemory() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fullPath = useMemo(() => {
    const base = pathname ?? "";
    const qs = searchParams?.toString();
    return qs ? `${base}?${qs}` : base;
  }, [pathname, searchParams]);

  const [lastByTab, setLastByTab] = useState<Partial<Record<TabKey, string>>>({});

  useEffect(() => {
    const next: Partial<Record<TabKey, string>> = {};
    for (const tabId of ["dashboard", ...MOBILE_TAB_ROUTES.map((route) => route.id)] as TabKey[]) {
      const stored = readStored(tabId);
      if (stored) next[tabId] = stored;
    }
    setLastByTab(next);
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const tabId = tabIdForPathname(pathname);
    if (!tabId || (tabId === "schedule" && isSocialSchedule(fullPath))) return;
    writeStorage(storageKey(tabId), fullPath);
    setLastByTab((prev) => (prev[tabId] === fullPath ? prev : { ...prev, [tabId]: fullPath }));
  }, [pathname, fullPath]);

  const getHref = (tabId: MobileTabId | undefined, fallbackHref: string) => {
    if (fallbackHref === "/") return lastByTab.dashboard ?? fallbackHref;
    if (!tabId) return fallbackHref;
    return lastByTab[tabId] ?? fallbackHref;
  };

  return { lastByTab, getHref };
}
