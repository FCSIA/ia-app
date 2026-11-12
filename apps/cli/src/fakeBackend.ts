// An in-memory stand-in for a site, its Better Auth routes, and the Convex
// functions the CLI calls, for tests that exercise real HTTP handling.

export const HOST = "https://app.fcsia.com";
export const CONVEX_URL = "https://cloud.example.test";
export const CONVEX_SITE_URL = "https://site.example.test";

export interface FakeSession {
  id: string;
  token: string;
  current?: boolean;
}

export interface FakeBackendOptions {
  minCliVersion?: string;
  // Responses to successive /device/token polls, after which it approves.
  pendingPolls?: Array<"authorization_pending" | "slow_down" | "access_denied" | "expired_token">;
  validTokens?: string[];
  profile?: Record<string, unknown> | null;
  discoveryStatus?: number;
}

export function fakeBackend(options: FakeBackendOptions = {}) {
  const validTokens = new Set(options.validTokens ?? []);
  const pending = [...(options.pendingPolls ?? [])];
  const sessions: Array<{ id: string; token: string }> = [...validTokens].map((token, index) => ({
    id: `session${index + 1}`,
    token,
  }));
  const calls: string[] = [];
  let issued = 0;
  const profile =
    options.profile === undefined
      ? { _id: "user1", uniqueId: "STU050", firstName: "David", lastName: "Jones", roles: ["STUDENT"] }
      : options.profile;
  const leader = { _id: "user2", uniqueId: "STU011", firstName: "Ada", lastName: "Byron", roles: ["STUDENT"] };
  const sponsor = { _id: "user3", uniqueId: "TCH001", firstName: "Grace", lastName: "Hopper", roles: ["TEACHER"] };
  const personResult = { _id: "user2", firstName: "Ada", lastName: "Byron", preferredName: null, avatarUrl: null };
  const clubName = "Robotics Club";
  const announcements = [
    {
      _id: "ann1",
      _creationTime: 1,
      authorId: "user3",
      title: "Picture day is Thursday",
      body: "Bring your smile to the gym between periods.",
      targetType: "SCHOOL_WIDE",
      targetGrades: [],
      targetPathway: null,
      targetMajorPathways: [],
      targetMinorPathways: [],
      clubId: null,
      status: "ACTIVE",
      promotedUntil: null,
      expiresAt: null,
      createdAt: Date.UTC(2026, 10, 9, 13),
      author: { ...sponsor, preferredName: null, avatarUrl: null, isDeveloper: false },
      club: null,
      commentCount: 2,
      images: [],
      isRead: false,
      isBookmarked: false,
      isPinned: false,
      isPromoted: false,
    },
    {
      _id: "ann2",
      _creationTime: 2,
      authorId: "user2",
      title: "Build night this Friday",
      body: "Shop opens at 3:30.",
      targetType: "CLUB",
      targetGrades: [],
      targetPathway: null,
      targetMajorPathways: [],
      targetMinorPathways: [],
      clubId: "club1",
      status: "ACTIVE",
      promotedUntil: null,
      expiresAt: null,
      createdAt: Date.UTC(2026, 10, 8, 18),
      author: { ...leader, preferredName: null, avatarUrl: null, isDeveloper: false },
      club: { _id: "club1", name: clubName },
      commentCount: 0,
      images: [],
      isRead: true,
      isBookmarked: false,
      isPinned: false,
      isPromoted: false,
    },
  ];
  const comments = [
    { _id: "comment1", announcementId: "ann1", authorId: "user2", body: "See you there.", createdAt: Date.UTC(2026, 10, 9, 14), author: { ...leader, preferredName: null, avatarUrl: null, isDeveloper: false } },
    { _id: "comment2", announcementId: "ann1", authorId: "user1", body: "What time?", createdAt: Date.UTC(2026, 10, 9, 15), author: { ...profile, preferredName: null, avatarUrl: null, isDeveloper: false } },
  ];
  const events = [
    {
      _id: "event1",
      _creationTime: 3,
      authorId: "user3",
      clubId: null,
      categoryId: null,
      status: "PUBLISHED",
      type: "GENERAL",
      title: "College visit: State U",
      description: "Meet in the media center.",
      location: "Media center",
      flyerUrl: null,
      startAt: Date.UTC(2026, 10, 12, 15),
      endAt: Date.UTC(2026, 10, 12, 16),
      registrationOpensAt: null,
      registrationClosesAt: null,
      author: { _id: "user3", firstName: "Grace", lastName: "Hopper", preferredName: null },
      club: null,
    },
    {
      _id: "event2",
      _creationTime: 4,
      authorId: "user3",
      clubId: "club1",
      categoryId: null,
      status: "PUBLISHED",
      type: "CLUB",
      title: "Robotics scrimmage",
      description: null,
      location: "Gym",
      flyerUrl: null,
      startAt: Date.UTC(2020, 0, 2, 15),
      endAt: null,
      registrationOpensAt: null,
      registrationClosesAt: null,
      author: { _id: "user3", firstName: "Grace", lastName: "Hopper", preferredName: null },
      club: { _id: "club1", name: clubName },
    },
  ];
  const fridays = [
    {
      _id: "flex1",
      date: Date.UTC(2026, 10, 13, 12),
      type: "ALL_STUDENT",
      gradeLevel: undefined,
      pathway: undefined,
      isSchoolDay: true,
      notes: undefined,
      sessionCount: 3,
      createdAt: Date.UTC(2026, 10, 1),
      _count: { sessions: 3 },
    },
    {
      _id: "flex0",
      date: Date.UTC(2026, 10, 6, 12),
      type: "PATHWAY_SPECIFIC",
      gradeLevel: undefined,
      pathway: "ENGINEERING",
      isSchoolDay: true,
      notes: "Shop safety refresher.",
      sessionCount: 2,
      createdAt: Date.UTC(2026, 9, 25),
      _count: { sessions: 2 },
    },
  ];
  const notifications = [
    {
      id: "notif1",
      category: "ACCOUNT_SECURITY",
      title: "New sign-in to your account",
      body: "A command-line client signed in as you.",
      href: "/profile",
      subject: null,
      isRead: false,
      createdAt: new Date(Date.UTC(2026, 10, 9, 18)).toISOString(),
    },
    {
      id: "notif2",
      category: "CLUB_CHANNEL_MENTION",
      title: "Ada mentioned you in #builds",
      body: "Can you review the drivetrain?",
      href: "/clubs/club1/channels/chan1",
      subject: "club1",
      isRead: true,
      createdAt: new Date(Date.UTC(2026, 10, 8, 18)).toISOString(),
    },
  ];
  const clubs = [
    {
      ...{
        _id: "club1",
        name: clubName,
        description: "Builds robots.",
        logoUrl: null,
        bannerUrl: null,
        accentColor: null,
        overview: "We design, build, and program robots for FIRST competitions.",
        joinPolicy: "OPEN",
        memberLimit: null,
        isActive: true,
        autoCreateUnitChannels: false,
        createdAt: Date.UTC(2026, 8, 1),
        updatedAt: Date.UTC(2026, 8, 1),
      },
      role: "President",
      _count: { members: 12, channels: 2 },
      unreadChannels: 1,
    },
  ];
  const channels = [
    { _id: "chan1", clubId: "club1", name: "builds", description: "Build talk.", visibility: "PUBLIC" },
    { _id: "chan2", clubId: "club1", name: "leaders", description: null, visibility: "RESTRICTED" },
  ];
  const messages = [
    {
      _id: "msg1",
      _creationTime: 5,
      channelId: "chan1",
      authorId: "user2",
      parentMessageId: undefined,
      replyToMessageId: undefined,
      body: "Drivetrain is mounted.",
      isPinned: false,
      pinnedAt: null,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(Date.UTC(2026, 10, 9, 15)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 10, 9, 15)).toISOString(),
      editedAt: null,
      threadRootId: "msg1",
      author: { ...leader, clubRole: null },
      mentions: [],
      attachments: [],
      attachmentsTruncated: false,
      reactions: [{ emoji: "🎉", count: 2, votedByCurrentUser: false }],
      reactionsTruncated: false,
      replyCount: 1,
      replyCountIsExact: true,
      hasReplies: true,
      latestReplyPreview: null,
      replyPreview: null,
      mentionsViewer: false,
    },
    {
      _id: "msg0",
      _creationTime: 6,
      channelId: "chan1",
      authorId: "user1",
      parentMessageId: undefined,
      replyToMessageId: undefined,
      body: "Working on it now.",
      isPinned: false,
      pinnedAt: null,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(Date.UTC(2026, 10, 9, 14)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 10, 9, 14)).toISOString(),
      editedAt: null,
      threadRootId: "msg0",
      author: { ...profile, clubRole: null },
      mentions: [],
      attachments: [],
      attachmentsTruncated: false,
      reactions: [],
      reactionsTruncated: false,
      replyCount: 0,
      replyCountIsExact: true,
      hasReplies: false,
      latestReplyPreview: null,
      replyPreview: null,
      mentionsViewer: false,
    },
  ];

  const json = (body: unknown, status = 200) => Response.json(body, { status });
  const bearer = (request: Request) => request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const jwtToken = (jwt: string) => jwt.replace(/^jwt:/, "");

  async function convex(request: Request, kind: "query" | "mutation") {
    const { path, args } = (await request.json()) as { path: string; args: unknown[] };
    calls.push(`${kind} ${path}`);
    const token = jwtToken(bearer(request));
    if (!validTokens.has(token)) {
      return json({ status: "error", errorMessage: "Unauthenticated", errorData: "Unauthenticated", logLines: [] }, 560);
    }
    const value = (() => {
      if (path === "users/me:me") return profile;
      if (path === "schedule/dashboard:getDay") {
        const { dateKey } = (args[0] ?? {}) as { dateKey: string };
        return {
          dateKey,
          weekday: "Wednesday",
          calendarSetupRequired: false,
          lunchPeriod: 5,
          lunchNeedsResolution: false,
          isSpecial: false,
          name: "Regular day",
          source: "REGULAR_TEMPLATE",
          sourceId: "template1",
          sourceTemplateId: "template1",
          hasPersonalSchedule: true,
          omittedPeriods: [],
          blocks: [
            {
              key: "p1",
              position: 1,
              label: "Period 1",
              displayLabel: "Period 1",
              periodNumber: 1,
              startTime: "08:30",
              endTime: "09:20",
              durationMinutes: 50,
              kind: "PERIOD",
              entry: {
                id: "entry1",
                weekday: "MONDAY",
                periodNumber: 1,
                className: "Algebra II",
                courseId: "course1",
                course: null,
              },
            },
            {
              key: "p4",
              position: 4,
              label: "Period 4",
              displayLabel: "Period 4",
              periodNumber: 4,
              startTime: "12:10",
              endTime: "13:00",
              durationMinutes: 50,
              kind: "LUNCH",
              entry: null,
            },
          ],
        };
      }
      if (path === "announcements/feed:list") {
        const { unreadOnly } = (args[0] ?? {}) as { unreadOnly?: boolean };
        return announcements.filter((announcement) => !unreadOnly || !announcement.isRead);
      }
      if (path === "announcements/feed:get") {
        const { announcementId } = (args[0] ?? {}) as { announcementId: string };
        const announcement = announcements.find((item) => item._id === announcementId);
        if (!announcement) return null;
        return {
          announcement,
          comments: announcement._id === "ann1" ? comments : [],
        };
      }
      if (path === "events/events:list") return events;
      if (path === "events/events:get") {
        const { eventId } = (args[0] ?? {}) as { eventId: string };
        return events.find((event) => event._id === eventId) ?? null;
      }
      if (path === "flexFriday/fridays:list") return fridays;
      if (path === "notifications/inbox:list") {
        const { limit, unreadOnly } = (args[0] ?? {}) as { limit?: number; unreadOnly?: boolean };
        return notifications
          .filter((notification) => !unreadOnly || !notification.isRead)
          .slice(0, Math.min(Math.max(limit ?? 100, 1), 100));
      }
      if (path === "clubs/management:getMyClubs") {
        return {
          memberOf: [clubs[0]],
          sponsoring: [],
          clubs,
        };
      }
      if (path === "clubs/detail:get") {
        const { clubId } = (args[0] ?? {}) as { clubId: string };
        const club = clubs.find((candidate) => candidate._id === clubId);
        if (!club) return null;
        return {
          ...club,
          members: [{ _id: "member1", user: profile, joinedAt: "2026-09-01", roles: [] }],
          leaders: [{ _id: "member2", user: leader, joinedAt: "2026-09-01", roles: ["President"] }],
          sponsors: [{ _id: "sponsor1", user: sponsor, joinedAt: "2026-09-01" }],
          roles: [],
          channels: [
            { _id: "chan1", clubId, name: "builds", description: null, visibility: "PUBLIC" },
            { _id: "chan2", clubId, name: "leaders", description: null, visibility: "RESTRICTED" },
          ],
          tags: [{ _id: "tag1", clubId, name: "robotics", slug: "robotics", createdById: "user2", createdAt: 0, members: [] }],
          directory: [],
          viewer: {
            isMember: true,
            hasClubRole: false,
            isSponsor: false,
            isAdmin: false,
            canAccessWorkspace: true,
            canManageChannels: false,
            canManageMembership: false,
            canApproveJoinRequests: false,
            permissions: {},
            hasPendingJoinRequest: false,
          },
          pendingJoinRequests: [],
          activeJoinCode: null,
        };
      }
      if (path === "clubs/channels:list") {
        const { clubId } = (args[0] ?? {}) as { clubId: string };
        return clubId === "club1" ? channels : [];
      }
      if (path === "clubs/channels:getById") {
        const { channelId } = (args[0] ?? {}) as { channelId: string };
        const channel = channels.find((candidate) => candidate._id === channelId);
        // The leadership channel is restricted, so a plain member can't read it.
        if (!channel || channelId === "chan2") return null;
        return { club: { _id: "club1", name: clubName }, channel };
      }
      if (path === "clubs/channels:getMessagePage") {
        const { channelId, paginationOpts } = (args[0] ?? {}) as {
          channelId: string;
          paginationOpts: { numItems: number; cursor: string | null };
        };
        if (channelId !== "chan1") return { page: [], isDone: true, continueCursor: "" };
        const size = Math.min(Math.max(Math.trunc(paginationOpts?.numItems ?? 30), 1), 40);
        const start = Number.parseInt(paginationOpts?.cursor ?? "0", 10) || 0;
        const slice = messages.slice(start, start + size);
        return {
          page: slice,
          isDone: start + size >= messages.length,
          continueCursor: start + size < messages.length ? String(start + size) : "",
          pageStatus: null,
        };
      }
      if (path === "search/global:palette") {
        const { search } = (args[0] ?? {}) as { search: string };
        const text = search.trim().toLocaleLowerCase();
        if (text.length < 2) return { people: [], channels: [] };
        return {
          people: text.includes("ada") ? [personResult] : [],
          channels: text.includes("build") ? [{ ...channels[0], club: { _id: "club1", name: clubName } }] : [],
        };
      }
      if (path === "users/cliSessions:list") {
        return sessions.map((session) => ({
          id: session.id,
          client: "Command-line client 0.1.0 on macOS",
          version: "0.1.0",
          platform: "macOS arm64",
          createdAt: Date.UTC(2026, 10, 8, 18),
          lastUsedAt: Date.UTC(2026, 10, 8, 18, 5),
          expiresAt: Date.UTC(2026, 10, 15, 18),
          current: session.token === token,
        }));
      }
      if (path === "users/cliSessions:revoke") {
        const { sessionId } = (args[0] ?? {}) as { sessionId: string };
        const index = sessions.findIndex((session) => session.id === sessionId);
        if (index === -1) return { outcome: "unchanged" };
        validTokens.delete(sessions[index]!.token);
        sessions.splice(index, 1);
        return { outcome: "revoked" };
      }
      throw new Error(`unexpected function ${path}`);
    })();
    return json({ status: "success", value, logLines: [] });
  }

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const where = `${url.origin}${url.pathname}`;
    if (where === `${HOST}/.well-known/fcsia-cli.json`) {
      calls.push("discovery");
      if (options.discoveryStatus) return new Response("nope", { status: options.discoveryStatus });
      return json({
        service: "fcsia",
        convexUrl: CONVEX_URL,
        convexSiteUrl: CONVEX_SITE_URL,
        appVersion: "1.0.0",
        minCliVersion: options.minCliVersion ?? "0.1.0",
      });
    }
    if (where === `${CONVEX_SITE_URL}/api/auth/device/code`) {
      calls.push("device code");
      return json({
        device_code: "device-code",
        user_code: "ABCDEFGH",
        // The backend's configured site differs from HOST; the CLI must point
        // people at HOST anyway.
        verification_uri: "http://localhost:3000/device",
        verification_uri_complete: "http://localhost:3000/device?user_code=ABCDEFGH",
        expires_in: 600,
        interval: 5,
      });
    }
    if (where === `${CONVEX_SITE_URL}/api/auth/device/token`) {
      calls.push("device token");
      const next = pending.shift();
      if (next) return json({ error: next, error_description: next }, 400);
      issued += 1;
      const token = `issued${issued}`;
      validTokens.add(token);
      sessions.push({ id: `issued-session${issued}`, token });
      return json({ access_token: token, token_type: "Bearer", expires_in: 604800, scope: "" });
    }
    if (where === `${CONVEX_SITE_URL}/api/auth/convex/token`) {
      calls.push("jwt");
      const token = bearer(request);
      return validTokens.has(token) ? json({ token: `jwt:${token}` }) : json({ code: "UNAUTHORIZED" }, 401);
    }
    if (where === `${CONVEX_SITE_URL}/api/auth/sign-out`) {
      calls.push("sign out");
      const token = bearer(request);
      if (!validTokens.has(token)) return json({ code: "UNAUTHORIZED" }, 401);
      validTokens.delete(token);
      return json({ success: true });
    }
    if (where === `${CONVEX_URL}/api/query`) return convex(request, "query");
    if (where === `${CONVEX_URL}/api/mutation`) return convex(request, "mutation");
    throw new TypeError(`fetch failed: ${where}`);
  }

  return { handle, calls, validTokens, sessions, announcements, comments, events, fridays, notifications, clubs, channels, messages, profile };
}
