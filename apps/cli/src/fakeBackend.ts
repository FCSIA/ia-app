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

interface FakeUserRow {
  _id: string;
  uniqueId: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  roles: string[];
  gradeLevel: number | null;
  major: string | null;
  minor: string | null;
  email: string;
  isActive: boolean;
  avatarUrl: string | null;
  isDeveloper: boolean;
}

interface FakeReportRow {
  _id: string;
  submitterId: string;
  contentType: string;
  contentId: string;
  clubId: string | null;
  reportedUserId: string | null;
  reason: string;
  status: string;
  isEscalated: boolean;
  appVersion?: string;
  createdAt: number;
  reviewedAt?: number;
  reviewNote?: string;
  githubIssueUrl?: string;
  submitter: Record<string, unknown> | null;
  reportedUser: Record<string, unknown> | null;
  club: { _id: string; name: string } | null;
  images: unknown[];
  responses: Array<{
    _id: string;
    body: string;
    createdAt: number;
    author: { firstName: string; lastName: string; preferredName: string | null };
  }>;
}

export function fakeBackend(options: FakeBackendOptions = {}) {
  const validTokens = new Set(options.validTokens ?? []);
  const pending = [...(options.pendingPolls ?? [])];
  const sessions: Array<{ id: string; token: string }> = [...validTokens].map((token, index) => ({
    id: `session${index + 1}`,
    token,
  }));
  const calls: string[] = [];
  const invocations: Array<{ path: string; args: unknown[] }> = [];
  let issued = 0;
  let createdCount = 0;
  const pendingApprovals = new Map<string, string>([["ann3", "Chipotle fundraiser"]]);
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
  // Relative to now so "upcoming" stays upcoming however long this fixture lives.
  const upcomingStart = Date.now() + 24 * 60 * 60 * 1000;
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
      startAt: upcomingStart,
      endAt: upcomingStart + 60 * 60 * 1000,
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
  const messages: Array<Record<string, unknown>> = [
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

  const userRows: FakeUserRow[] = [
    {
      _id: "user1",
      uniqueId: "STU050",
      firstName: "David",
      lastName: "Jones",
      preferredName: null,
      roles: ["STUDENT"],
      gradeLevel: 11,
      major: "ENGINEERING",
      minor: null,
      email: "david.jones@example.com",
      isActive: true,
      avatarUrl: null,
      isDeveloper: false,
    },
    {
      _id: "user2",
      uniqueId: "STU011",
      firstName: "Ada",
      lastName: "Byron",
      preferredName: "Ada",
      roles: ["STUDENT", "STUDENT_LEADER"],
      gradeLevel: 12,
      major: "INFORMATION_TECHNOLOGY",
      minor: "ENGINEERING",
      email: "ada.byron@example.com",
      isActive: true,
      avatarUrl: null,
      isDeveloper: false,
    },
    {
      _id: "user3",
      uniqueId: "TCH001",
      firstName: "Grace",
      lastName: "Hopper",
      preferredName: null,
      roles: ["TEACHER", "SPONSOR"],
      gradeLevel: null,
      major: null,
      minor: null,
      email: "grace.hopper@example.com",
      isActive: true,
      avatarUrl: null,
      isDeveloper: false,
    },
    {
      _id: "user4",
      uniqueId: "STU002",
      firstName: "Katherine",
      lastName: "Johnson",
      preferredName: null,
      roles: ["STUDENT"],
      gradeLevel: 10,
      major: "HEALTH_SCIENCE",
      minor: null,
      email: "katherine.johnson@example.com",
      isActive: false,
      avatarUrl: null,
      isDeveloper: false,
    },
  ];
  const auditEvents = [
    {
      id: "audit1",
      action: "user.deactivated",
      entityType: "user",
      entityId: "user4",
      createdAt: new Date(Date.UTC(2026, 10, 10, 14)).toISOString(),
      meta: { reason: "Transferred to another school" },
      actorId: "user3",
      actor: { id: "user3", firstName: "Grace", lastName: "Hopper", preferredName: null, uniqueId: "TCH001" },
      context: {
        title: "Deactivated Katherine Johnson",
        subtitle: "user4",
        links: [],
        references: [],
        deleted: false,
      },
    },
    {
      id: "audit2",
      action: "user.roles_assigned",
      entityType: "user",
      entityId: "user2",
      createdAt: new Date(Date.UTC(2026, 10, 9, 14)).toISOString(),
      meta: { roles: ["STUDENT", "STUDENT_LEADER"] },
      actorId: "user3",
      actor: { id: "user3", firstName: "Grace", lastName: "Hopper", preferredName: null, uniqueId: "TCH001" },
      context: {
        title: "Made Ada Byron a student leader",
        subtitle: "user2",
        links: [],
        references: [],
        deleted: false,
      },
    },
  ];
  const reportRows: FakeReportRow[] = [
    {
      _id: "report1",
      submitterId: "user2",
      contentType: "CLUB_CHANNEL_MESSAGE",
      contentId: "msg1",
      clubId: "club1",
      reportedUserId: "user1",
      reason: "Says something unkind about another member.",
      status: "PENDING",
      isEscalated: true,
      createdAt: Date.UTC(2026, 10, 10, 15),
      submitter: { _id: "user2", uniqueId: "STU011", firstName: "Ada", lastName: "Byron", preferredName: "Ada" },
      reportedUser: { _id: "user1", uniqueId: "STU050", firstName: "David", lastName: "Jones", preferredName: null },
      club: { _id: "club1", name: clubName },
      images: [],
      responses: [],
    },
    {
      _id: "report2",
      submitterId: "user1",
      contentType: "ANNOUNCEMENT",
      contentId: "ann2",
      clubId: "club1",
      reportedUserId: null,
      reason: "The date is wrong.",
      status: "RESOLVED",
      isEscalated: false,
      createdAt: Date.UTC(2026, 10, 8, 15),
      reviewNote: "Fixed the date.",
      submitter: { _id: "user1", uniqueId: "STU050", firstName: "David", lastName: "Jones", preferredName: null },
      reportedUser: null,
      club: { _id: "club1", name: clubName },
      images: [],
      responses: [],
    },
    {
      _id: "fb1",
      submitterId: "user1",
      contentType: "GENERAL",
      contentId: "feedback1",
      clubId: null,
      reportedUserId: null,
      reason: "The bell schedule disappears on Fridays.",
      status: "PENDING",
      isEscalated: false,
      appVersion: "1.4.0",
      createdAt: Date.UTC(2026, 10, 10, 16),
      githubIssueUrl: "https://github.com/FCSIA/ia-app/issues/100",
      submitter: { _id: "user1", uniqueId: "STU050", firstName: "David", lastName: "Jones", preferredName: null },
      reportedUser: null,
      club: null,
      images: [],
      responses: [],
    },
    {
      _id: "fb2",
      submitterId: "user2",
      contentType: "GENERAL",
      contentId: "feedback2",
      clubId: null,
      reportedUserId: null,
      reason: "Could the club page show meeting times?",
      status: "RESOLVED",
      isEscalated: false,
      appVersion: "1.3.0",
      createdAt: Date.UTC(2026, 10, 5, 16),
      reviewNote: "Meeting times are on the calendar now.",
      reviewedAt: Date.UTC(2026, 10, 6, 16),
      submitter: { _id: "user2", uniqueId: "STU011", firstName: "Ada", lastName: "Byron", preferredName: "Ada" },
      reportedUser: null,
      club: null,
      images: [],
      responses: [
        {
          _id: "response1",
          body: "This is in the works.",
          createdAt: Date.UTC(2026, 10, 5, 18),
          author: { firstName: "Grace", lastName: "Hopper", preferredName: null },
        },
      ],
    },
  ];

  const flexSessions = [
    {
      _id: "sess1",
      flexFridayId: "flex1",
      title: "Session 1",
      description: null,
      startTime: "13:00",
      endTime: "13:45",
      sessionType: "WORKSHOP",
      createdAt: Date.UTC(2026, 10, 2),
      updatedAt: Date.UTC(2026, 10, 2),
    },
  ];
  const workshopRows = [
    {
      _id: "ws1",
      title: "Robot Drivetrain",
      description: "Gears, motors, and testing.",
      location: "Room 214",
      capacity: 12,
      teacherId: "user3",
      createdAt: Date.UTC(2026, 10, 2),
      updatedAt: Date.UTC(2026, 10, 2),
    },
  ];
  const flexRegistrations: Array<{ _id: string; workshopId: string; studentId: string; createdAt: number }> = [];
  const viewerId = String(profile?._id ?? "user1");
  const workshopView = (workshopId: string) => {
    const workshop = workshopRows.find((candidate) => candidate._id === workshopId);
    if (!workshop) return null;
    const registrations = flexRegistrations.filter((row) => row.workshopId === workshopId);
    return {
      ...workshop,
      _count: { registrations: registrations.length },
      registrations: registrations
        .filter((row) => row.studentId === viewerId)
        .map((row) => ({ _id: row._id })),
      assignments: [],
      linkedSessions: flexSessions.map((session) => ({
        _id: session._id,
        title: session.title,
        startTime: session.startTime,
        endTime: session.endTime,
      })),
    };
  };

  const json = (body: unknown, status = 200) => Response.json(body, { status });
  const bearer = (request: Request) => request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const jwtToken = (jwt: string) => jwt.replace(/^jwt:/, "");

  async function convex(request: Request, kind: "query" | "mutation" | "action") {
    const { path, args } = (await request.json()) as { path: string; args: unknown[] };
    calls.push(`${kind} ${path}`);
    invocations.push({ path, args });
    const token = jwtToken(bearer(request));
    if (!validTokens.has(token)) {
      return json({ status: "error", errorMessage: "Unauthenticated", errorData: "Unauthenticated", logLines: [] }, 560);
    }
    let value: unknown;
    try {
      value = (() => {
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
        if (path === "flexFriday/sessions:listByFriday") {
          const { flexFridayId } = (args[0] ?? {}) as { flexFridayId: string };
          return flexFridayId === "flex1" ? flexSessions : [];
        }
        if (path === "flexFriday/workshops:listBySession") {
          const { sessionId } = (args[0] ?? {}) as { sessionId: string };
          const workshop = sessionId === "sess1" ? workshopView("ws1") : null;
          return workshop ? [workshop] : [];
        }
        if (path === "flexFriday/registration:getMyRegistrations") {
          return flexRegistrations.map((registration) => {
            const workshop = workshopView(registration.workshopId);
            return {
              ...registration,
              workshop: workshop
                ? {
                    ...workshop,
                    sessions: [{ session: { ...flexSessions[0], flexFriday: fridays[0] } }],
                  }
                : null,
            };
          });
        }
        if (path === "flexFriday/registration:register") {
          const { workshopId } = (args[0] ?? {}) as { workshopId: string };
          if (!workshopRows.some((workshop) => workshop._id === workshopId)) {
            throw new Error("Workshop not found");
          }
          if (flexRegistrations.some((row) => row.workshopId === workshopId && row.studentId === viewerId)) {
            throw new Error("Already registered for this workshop");
          }
          const id = `reg${flexRegistrations.length + 1}`;
          flexRegistrations.push({ _id: id, workshopId, studentId: viewerId, createdAt: Date.now() });
          return id;
        }
        if (path === "flexFriday/registration:unregister") {
          const { workshopId } = (args[0] ?? {}) as { workshopId: string };
          const index = flexRegistrations.findIndex(
            (row) => row.workshopId === workshopId && row.studentId === viewerId,
          );
          if (index === -1) throw new Error("Registration not found");
          flexRegistrations.splice(index, 1);
          return null;
        }
        if (path === "notifications/inbox:list") {
          const { limit, unreadOnly } = (args[0] ?? {}) as { limit?: number; unreadOnly?: boolean };
          return notifications
            .filter((notification) => !unreadOnly || !notification.isRead)
            .slice(0, Math.min(Math.max(limit ?? 100, 1), 100));
        }
        if (path === "notifications/inbox:markRead") {
          const { ids } = (args[0] ?? {}) as { ids: string[] };
          for (const id of ids) {
            const notification = notifications.find((candidate) => candidate.id === id);
            if (notification) notification.isRead = true;
          }
          return { success: true };
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
        if (path === "clubs/channels:postMessage") {
          const { channelId, body } = (args[0] ?? {}) as { channelId: string; body: string };
          if (channelId !== "chan1") throw new Error("Cannot post in this channel");
          const id = `msg${messages.length + 1}`;
          messages.unshift({
            _id: id,
            _creationTime: Date.UTC(2026, 10, 9, 16),
            channelId,
            authorId: viewerId,
            body,
            isPinned: false,
            isDeleted: false,
            createdAt: new Date(Date.UTC(2026, 10, 9, 16)).toISOString(),
            updatedAt: new Date(Date.UTC(2026, 10, 9, 16)).toISOString(),
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
          });
          return id;
        }
        if (path === "users/admin:list") {
          const { paginationOpts, search, userId, roleGroup } = (args[0] ?? {}) as {
            paginationOpts: { numItems: number; cursor: string | null };
            search?: string;
            userId?: string;
            roleGroup?: string;
          };
          if (userId !== undefined) {
            const target = userRows.find((user) => user._id === userId);
            return { page: target ? [target] : [], isDone: true, continueCursor: "" };
          }
          const text = search?.trim().toLowerCase();
          const group = roleGroup ?? "all";
          const filtered = userRows.filter((user) => {
            const isStudentAccount = user.roles.some((role) => role.startsWith("STUDENT"));
            const isTeacher = user.roles.includes("TEACHER") || user.roles.includes("SPONSOR");
            const inGroup =
              group === "students"
                ? isStudentAccount && !user.roles.includes("STUDENT_ADMIN")
                : group === "student-admin"
                  ? user.roles.includes("STUDENT_ADMIN")
                  : group === "teachers"
                    ? isTeacher
                    : group === "other"
                      ? !isStudentAccount && !isTeacher
                      : true;
            if (!inGroup) return false;
            if (!text) return true;
            return [user.uniqueId, user.firstName, user.lastName, user.preferredName ?? "", user.email].some(
              (value) => value.toLowerCase().includes(text),
            );
          });
          const size = Math.min(Math.max(Math.trunc(paginationOpts?.numItems ?? 25), 1), 100);
          const start = Number.parseInt(paginationOpts?.cursor ?? "0", 10) || 0;
          return {
            page: filtered.slice(start, start + size),
            isDone: start + size >= filtered.length,
            continueCursor: start + size < filtered.length ? String(start + size) : "",
          };
        }
        if (path === "users/admin:activate" || path === "users/admin:deactivate") {
          const { userId } = (args[0] ?? {}) as { userId: string };
          const target = userRows.find((user) => user._id === userId);
          if (!target) throw new Error("User not found.");
          target.isActive = path === "users/admin:activate";
          return target;
        }
        if (path === "users/admin:deleteUsers") {
          const { userIds } = (args[0] ?? {}) as { userIds: string[] };
          let deleted = 0;
          for (const userId of userIds) {
            const index = userRows.findIndex((user) => user._id === userId);
            if (index === -1) throw new Error("One or more selected users no longer exist.");
            userRows.splice(index, 1);
            deleted += 1;
          }
          return { deleted };
        }
        if (path === "users/admin:assignRoles") {
          const { userId, roles } = (args[0] ?? {}) as { userId: string; roles: string[] };
          const target = userRows.find((user) => user._id === userId);
          if (!target) throw new Error("User not found.");
          target.roles = roles;
          return target;
        }
        if (path === "users/admin:resetPassword") {
          const { userId } = (args[0] ?? {}) as { userId: string };
          if (!userRows.some((user) => user._id === userId)) throw new Error("User not found.");
          return { temporaryPassword: "Temp-pass-4821" };
        }
        if (path === "users/admin:exportStudents") {
          return userRows
            .filter((user) => user.roles.some((role) => role.startsWith("STUDENT")))
            .map((user) => ({
              firstName: user.firstName,
              lastName: user.lastName,
              uniqueId: user.uniqueId,
              email: user.email,
              gradeLevel: user.gradeLevel,
              major: user.major,
              minor: user.minor,
            }));
        }
        if (path === "users/admin:importStudents") {
          const { rows } = (args[0] ?? {}) as {
            rows: Array<{ uniqueId: string; firstName: string; lastName: string; email?: string }>;
          };
          const errors: string[] = [];
          const generatedCredentials: Array<Record<string, string>> = [];
          let created = 0;
          let skipped = 0;
          for (const row of rows) {
            if (userRows.some((user) => user.uniqueId.toLowerCase() === row.uniqueId.toLowerCase())) {
              skipped += 1;
              errors.push(`${row.uniqueId}: already exists.`);
              continue;
            }
            const email = row.email ?? `${row.uniqueId.toLowerCase()}@example.com`;
            userRows.push({
              _id: `user${userRows.length + 1}`,
              uniqueId: row.uniqueId,
              firstName: row.firstName,
              lastName: row.lastName,
              preferredName: null,
              roles: ["STUDENT"],
              gradeLevel: 9,
              major: null,
              minor: null,
              email,
              isActive: true,
              avatarUrl: null,
              isDeveloper: false,
            });
            generatedCredentials.push({
              firstName: row.firstName,
              lastName: row.lastName,
              uniqueId: row.uniqueId,
              email,
              temporaryPassword: `Temp-${row.uniqueId}`,
            });
            created += 1;
          }
          return { created, skipped, errors, generatedCredentials };
        }
        if (path === "audit/events:list") {
          const filters = (args[0] ?? {}) as {
            limit?: number;
            query?: string;
            action?: string;
            entityType?: string;
            startDate?: string;
            endDate?: string;
          };
          const text = filters.query?.trim().toLowerCase();
          return auditEvents
            .filter((event) => !filters.action || event.action === filters.action)
            .filter((event) => !filters.entityType || event.entityType === filters.entityType)
            .filter((event) => !filters.startDate || event.createdAt.slice(0, 10) >= filters.startDate)
            .filter((event) => !filters.endDate || event.createdAt.slice(0, 10) <= filters.endDate)
            .filter(
              (event) =>
                !text ||
                `${event.action} ${event.context.title} ${event.context.subtitle}`.toLowerCase().includes(text),
            )
            .slice(0, Math.min(Math.max(filters.limit ?? 100, 1), 500));
        }
        if (path === "audit/events:get") {
          const { auditEventId } = (args[0] ?? {}) as { auditEventId: string };
          return auditEvents.find((event) => event.id === auditEventId) ?? null;
        }
        if (path === "moderation/reports:list") {
          const { status, clubId, isEscalated } = (args[0] ?? {}) as {
            status?: string;
            clubId?: string;
            isEscalated?: boolean;
          };
          return reportRows
            .filter((report) => report.contentType !== "GENERAL")
            .filter((report) => !status || report.status === status)
            .filter((report) => !clubId || report.clubId === clubId)
            .filter((report) => isEscalated === undefined || report.isEscalated === isEscalated);
        }
        if (path === "moderation/reports:listFeedback") {
          return reportRows.filter((report) => report.contentType === "GENERAL");
        }
        if (path === "moderation/reports:getFeedback") {
          const { reportId } = (args[0] ?? {}) as { reportId: string };
          return (
            reportRows.find((report) => report._id === reportId && report.contentType === "GENERAL") ?? null
          );
        }
        if (path === "moderation/reports:addFeedbackResponse") {
          const { reportId, body } = (args[0] ?? {}) as { reportId: string; body: string };
          const report = reportRows.find((candidate) => candidate._id === reportId);
          if (!report) throw new Error("Report not found");
          const id = `response${report.responses.length + 2}`;
          report.responses.push({
            _id: id,
            body,
            createdAt: Date.now(),
            author: { firstName: "Grace", lastName: "Hopper", preferredName: null },
          });
          return id;
        }
        if (path === "moderation/reports:update") {
          const { reportId, status, reviewNote, expectedStatus } = (args[0] ?? {}) as {
            reportId: string;
            status: string;
            reviewNote: string;
            expectedStatus?: string;
          };
          const report = reportRows.find((candidate) => candidate._id === reportId);
          if (!report) throw new Error("Report not found");
          if (report.contentType !== "GENERAL" && status === "IN_REVIEW") {
            throw new Error("Only feedback can be marked in review");
          }
          if (expectedStatus !== undefined && expectedStatus !== report.status) {
            throw new Error("This item was updated by someone else. Check its latest status and try again.");
          }
          report.status = status;
          report.reviewNote = reviewNote;
          return { success: true };
        }
        if (path === "announcements/feed:create") {
          const created = args[0] as { title: string };
          createdCount += 1;
          const id = `ann-created-${createdCount}`;
          pendingApprovals.set(id, created.title);
          return id;
        }
        if (path === "announcements/feed:approve" || path === "announcements/feed:reject") {
          const { announcementId } = (args[0] ?? {}) as { announcementId: string };
          if (!pendingApprovals.has(announcementId) && !announcements.some((item) => item._id === announcementId)) {
            throw new Error("Announcement not found");
          }
          if (!pendingApprovals.delete(announcementId)) {
            throw new Error("This announcement is no longer waiting for approval");
          }
          return null;
        }
        if (path === "events/events:cancel") {
          const { eventId } = (args[0] ?? {}) as { eventId: string };
          const event = events.find((candidate) => candidate._id === eventId);
          if (!event) throw new Error("Event not found");
          event.status = "CANCELLED";
          return null;
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json({ status: "error", errorMessage: message, errorData: message, logLines: [] }, 560);
    }
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
    if (where === `${CONVEX_URL}/api/action`) return convex(request, "action");
    throw new TypeError(`fetch failed: ${where}`);
  }

  return { handle, calls, invocations, validTokens, sessions, announcements, comments, events, fridays, notifications, clubs, channels, messages, profile, flexSessions, workshopRows, flexRegistrations, userRows, auditEvents, reportRows };
}
