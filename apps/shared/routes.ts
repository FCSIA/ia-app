/**
 * Web paths the server writes into notifications and audit links, and the
 * query parameters the web app reads back. Builders and parsers live together
 * so a route changes in one place.
 */

export const NOTIFICATIONS_HREF = "/notifications";
export const REPORT_HREF = "/report";
export const PROFILE_HREF = "/profile";
export const CALENDAR_HREF = "/calendar";
export const FLEX_FRIDAY_HREF = "/flex-friday";
export const SCHEDULE_HREF = "/schedule";
export const CLUBS_HREF = "/clubs";
export const CLUBS_DISCOVER_HREF = "/clubs/discover";
export const ADMIN_MODERATION_TAB_HREF = "/admin?tab=moderation";
export const ADMIN_MODERATION_HREF = "/admin/moderation";

type SearchParamsLike = { get(name: string): string | null } | null | undefined;

export function announcementHref(announcementId: string) {
  return `/announcements/${announcementId}`;
}

export function eventHref(eventId: string) {
  return `/events/${eventId}`;
}

export function adminFeedbackHref(reportId: string) {
  return `/admin/feedback/${reportId}`;
}

export function adminUserHref(userId: string) {
  return `/admin/users?user=${userId}`;
}

export function clubHref(clubId: string) {
  return `/clubs/${clubId}`;
}

export function clubPeopleHref(clubId: string) {
  return `${clubHref(clubId)}/people`;
}

export function clubVolunteeringHref(clubId: string) {
  return `${clubHref(clubId)}/volunteering`;
}

export function clubNavigationHref(clubId: string) {
  return `${clubHref(clubId)}/navigation`;
}

export function clubSettingsHref(clubId: string, section?: "channels" | "structure") {
  return section ? `${clubHref(clubId)}/settings/${section}` : `${clubHref(clubId)}/settings`;
}

export function clubChannelSettingsHref(clubId: string, channelId: string) {
  return `${clubSettingsHref(clubId, "channels")}/${channelId}`;
}

export function clubPeopleRequestsHref(clubId: string) {
  return `${clubHref(clubId)}/people?tab=requests`;
}

/** A channel, optionally opened on a message or on a whiteboard (never both). */
export function clubChannelHref(
  clubId: string,
  channelId: string,
  target?: { messageId: string } | { whiteboardId: string },
) {
  const path = `${clubHref(clubId)}/channels/${channelId}`;
  if (!target) return path;
  if ("messageId" in target) return `${path}?message=${target.messageId}`;
  return `${path}?view=whiteboard&board=${target.whiteboardId}`;
}

/** The channel URL's query string switched to the chat, or to the whiteboards (optionally one open board). Other parameters are kept. */
export function clubChannelViewQuery(
  current: { toString(): string } | null | undefined,
  view: { view: "chat" } | { view: "whiteboard"; boardId?: string | null },
) {
  const next = new URLSearchParams(current?.toString());
  if (view.view === "chat") {
    next.delete("view");
    next.delete("board");
  } else {
    next.set("view", "whiteboard");
    if (view.boardId) next.set("board", view.boardId);
    else next.delete("board");
  }
  return next.toString();
}

export function parseClubChannelLink(search: SearchParamsLike) {
  return {
    whiteboardRequested: search?.get("view") === "whiteboard",
    whiteboardId: search?.get("board") ?? null,
    messageId: search?.get("message") ?? null,
  };
}

export function parseClubPeopleLink(search: SearchParamsLike) {
  return { requestsTab: search?.get("tab") === "requests" };
}

/** A club link that joins with the club's code, or with one unit's code. */
export function clubJoinHref(
  clubId: string,
  join: { code: string } | { unitId: string; unitCode: string },
) {
  return "code" in join
    ? `${clubHref(clubId)}?joinCode=${join.code}`
    : `${clubHref(clubId)}?unitId=${join.unitId}&unitCode=${join.unitCode}`;
}

export function parseClubJoinLink(search: SearchParamsLike) {
  return {
    code: search?.get("joinCode") ?? null,
    unitId: search?.get("unitId") ?? null,
    unitCode: search?.get("unitCode") ?? null,
  };
}

export const SCHEDULE_FRIENDS_HREF = `${SCHEDULE_HREF}?tab=friends`;
export const SCHEDULE_FRIEND_REQUESTS_HREF = `${SCHEDULE_FRIENDS_HREF}&section=requests`;

export function scheduleFriendHref(friendId: string) {
  return `${SCHEDULE_FRIENDS_HREF}&friend=${friendId}`;
}

export function scheduleFriendJoinHref(token: string) {
  return `/schedule/friends/join/${token}`;
}

/** A workshop keeps one identity even when it spans several sessions. */
export function workshopDetailHref(fridayId: string, workshopId: string, sessionId?: string) {
  const path = `${FLEX_FRIDAY_HREF}/${encodeURIComponent(fridayId)}/workshop/${encodeURIComponent(workshopId)}`;
  return sessionId ? `${path}?${new URLSearchParams({ session: sessionId })}` : path;
}

/** Pulls the ids out of an in-app path; each matcher returns null on a miss. */
export function matchClubChannelPath(path: string) {
  const match = path.match(/^\/clubs\/([^/]+)\/channels\/([^/?#]+)/);
  return match ? { clubId: match[1], channelId: match[2] } : null;
}

export function matchClubPeoplePath(path: string) {
  const match = path.match(/^\/clubs\/([^/?#]+)\/people/);
  return match ? { clubId: match[1] } : null;
}

export function matchClubPath(path: string) {
  const match = path.match(/^\/clubs\/([^/?#]+)/);
  return match ? { clubId: match[1] } : null;
}
