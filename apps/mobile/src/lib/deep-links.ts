import { router } from "expo-router";

export function normalizeHref(href?: string | null) {
  if (!href) return "/";
  try {
    const url = new URL(href);
    return url.pathname + url.search;
  } catch {
    return href.startsWith("/") ? href : `/${href}`;
  }
}

export function openAppHref(href?: string | null) {
  const path = normalizeHref(href);
  if (path.startsWith("/clubs/") || path.startsWith("/announcements/")) {
    router.push(path as never);
    return;
  }
  if (path.startsWith("/events")) {
    router.push("/events" as never);
    return;
  }
  if (path.startsWith("/flex-friday")) {
    router.push("/flex-friday" as never);
    return;
  }
  if (path.startsWith("/notifications")) {
    router.push("/notifications" as never);
    return;
  }
  router.push("/dashboard" as never);
}
