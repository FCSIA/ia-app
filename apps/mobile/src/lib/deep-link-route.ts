import {
  clubChannelHref,
  clubHref,
  matchClubChannelPath,
  matchClubPath,
  matchClubPeoplePath,
} from "~/apps/shared/routes";

export function normalizeHref(href?: string | null) {
  if (!href) return "/";
  try {
    const url = new URL(href);
    return url.pathname + url.search;
  } catch {
    return href.startsWith("/") ? href : `/${href}`;
  }
}

export function resolveAppHref(href?: string | null) {
  const path = normalizeHref(href);

  if (path.startsWith("/announcements/")) return path;
  if (path.startsWith("/announcements")) return "/announcements";

  const channel = matchClubChannelPath(path);
  if (channel) return clubChannelHref(channel.clubId, channel.channelId);

  const clubPeople = matchClubPeoplePath(path);
  if (clubPeople) return `${clubHref(clubPeople.clubId)}/people`;

  const club = matchClubPath(path);
  if (club) return clubHref(club.clubId);

  if (path.startsWith("/courses/")) return path;
  if (path.startsWith("/courses")) return "/courses";
  if (path.startsWith("/calendar")) return "/calendar";
  if (path.startsWith("/schedule")) return "/calendar";
  if (path.startsWith("/events/")) return path;
  if (path.startsWith("/events")) return "/events";
  if (path.startsWith("/flex-friday/pass")) return "/flex-friday/pass";
  if (path.startsWith("/flex-friday")) return "/flex-friday";
  if (path.startsWith("/wrapped")) return "/wrapped";
  if (path.startsWith("/notifications")) return "/notifications";
  if (path.startsWith("/profile")) return "/profile";
  if (path.startsWith("/settings/theme")) return "/settings/theme";
  if (path.startsWith("/admin?tab=moderation")) return "/admin/moderation";
  if (path.startsWith("/admin")) return "/admin";

  return "/dashboard";
}
