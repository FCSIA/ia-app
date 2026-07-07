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

  if (path.startsWith("/announcements/")) {
    router.push(path as never);
    return;
  }

  const channelMatch = path.match(/^\/clubs\/([^/]+)\/channels\/([^/?#]+)/);
  if (channelMatch) {
    router.push(`/clubs/${channelMatch[1]}/channels/${channelMatch[2]}` as never);
    return;
  }

  const clubMatch = path.match(/^\/clubs\/([^/?#]+)/);
  if (clubMatch) {
    router.push(`/clubs/${clubMatch[1]}` as never);
    return;
  }

  if (path.startsWith("/courses/")) {
    router.push(path as never);
    return;
  }
  if (path.startsWith("/courses")) {
    router.push("/courses" as never);
    return;
  }
  if (path.startsWith("/calendar")) {
    router.push("/calendar" as never);
    return;
  }
  if (path.startsWith("/events/")) {
    router.push(path as never);
    return;
  }
  if (path.startsWith("/events")) {
    router.push("/events" as never);
    return;
  }
  if (path.startsWith("/flex-friday/pass")) {
    router.push("/flex-friday/pass" as never);
    return;
  }
  if (path.startsWith("/flex-friday")) {
    router.push("/flex-friday" as never);
    return;
  }
  if (path.startsWith("/schedule")) {
    router.push("/schedule" as never);
    return;
  }
  if (path.startsWith("/wrapped")) {
    router.push("/wrapped" as never);
    return;
  }
  if (path.startsWith("/notifications")) {
    router.push("/notifications" as never);
    return;
  }
  if (path.startsWith("/profile")) {
    router.push("/profile" as never);
    return;
  }
  if (path.startsWith("/settings/theme")) {
    router.push("/settings/theme" as never);
    return;
  }
  router.push("/dashboard" as never);
}
