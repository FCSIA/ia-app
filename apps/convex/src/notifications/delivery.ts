import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { NotificationCategory } from "../validators";

export type NotificationSubject =
  | { kind: "announcement"; announcementId: Id<"announcements">; clubId?: Id<"clubs"> }
  | { kind: "event"; eventId: Id<"events">; clubId?: Id<"clubs"> }
  | { kind: "club"; clubId: Id<"clubs"> }
  | { kind: "clubChannel"; clubId: Id<"clubs">; channelId: Id<"clubChannels"> }
  | { kind: "clubMessage"; clubId: Id<"clubs">; channelId: Id<"clubChannels">; messageId: Id<"clubChannelMessages"> }
  | { kind: "flexFriday"; flexFridayId: Id<"flexFridays"> }
  | { kind: "moderationReport"; reportId: Id<"moderationReports"> }
  | { kind: "friendRequest"; friendshipId: Id<"studentScheduleFriends"> }
  | { kind: "system" };

type DeliveryInput = {
  userId: Id<"users">;
  category: NotificationCategory;
  title: string;
  body: string;
  href: string;
  subject: NotificationSubject;
};

function uniqueIds(ids: Id<"users">[]) {
  return Array.from(new Set(ids));
}

export async function deliverNotification(ctx: MutationCtx, input: DeliveryInput) {
  const scope = preferenceScope(input.subject);
  if (!(await shouldCreateDelivery(ctx, input.userId, input.category, scope.scopeKey))) {
    return;
  }

  await ctx.db.insert("notificationDeliveries", {
    userId: input.userId,
    category: input.category,
    title: input.title,
    body: input.body,
    href: input.href,
    subject: input.subject,
    isRead: false,
    createdAt: Date.now(),
  });

  await ctx.scheduler.runAfter(0, internal.notifications.pushNode.sendForDelivery, {
    userId: input.userId,
    category: input.category,
    title: input.title,
    body: input.body,
    href: input.href,
    scopeKey: scope.scopeKey,
  });
}

export async function deliverMany(ctx: MutationCtx, userIds: Id<"users">[], input: Omit<DeliveryInput, "userId">) {
  for (const userId of uniqueIds(userIds)) {
    await deliverNotification(ctx, { userId, ...input });
  }
}

export function preferenceScope(subject: NotificationSubject) {
  if (subject.kind === "clubMessage" || subject.kind === "clubChannel") {
    return { scopeKey: `channel:${subject.channelId}` };
  }
  if (subject.kind === "club") {
    return { scopeKey: `club:${subject.clubId}` };
  }
  if ((subject.kind === "announcement" || subject.kind === "event") && subject.clubId) {
    return { scopeKey: `club:${subject.clubId}` };
  }
  return { scopeKey: "global" };
}

async function shouldCreateDelivery(
  ctx: MutationCtx,
  userId: Id<"users">,
  category: NotificationCategory,
  scopeKey: string,
) {
  const preferences = await ctx.db
    .query("notificationPreferences")
    .withIndex("by_userId_and_category_and_scopeKey", (q) => q.eq("userId", userId).eq("category", category))
    .take(100);
  const preference =
    preferences.find((pref) => pref.scopeKey === scopeKey) ??
    preferences.find((pref) => pref.scopeKey === "global");

  if (preference) return preference.enabled && preference.level !== "OFF";
  if (category === "CLUB_CHANNEL_MESSAGE") return false;
  return true;
}

export async function activeUsers(ctx: MutationCtx) {
  return (await ctx.db.query("users").take(5000)).filter((user) => user.isActive);
}

export async function activeAdmins(ctx: MutationCtx) {
  return (await activeUsers(ctx)).filter((user) =>
    user.roles.some((role) => role === "ADMIN" || role === "SUPER_ADMIN" || role === "SUPPORT_STAFF"),
  );
}

export async function activeStudents(ctx: MutationCtx) {
  return (await activeUsers(ctx)).filter((user) => user.isStudent);
}

export async function clubAudience(ctx: MutationCtx, clubId: Id<"clubs">) {
  const members = await ctx.db
    .query("clubMembers")
    .withIndex("by_clubId", (q) => q.eq("clubId", clubId))
    .collect();
  const sponsors = await ctx.db
    .query("clubSponsors")
    .filter((q) => q.eq(q.field("clubId"), clubId))
    .collect();
  return uniqueIds([...members.map((row) => row.userId), ...sponsors.map((row) => row.userId)]);
}

export async function channelAudience(ctx: MutationCtx, channel: Doc<"clubChannels">) {
  if (channel.visibility === "PRIVATE") {
    const members = await ctx.db
      .query("clubChannelMemberships")
      .filter((q) => q.eq(q.field("channelId"), channel._id))
      .collect();
    return uniqueIds(members.map((row) => row.userId));
  }

  return clubAudience(ctx, channel.clubId);
}

export async function announcementAudience(ctx: MutationCtx, ann: Doc<"announcements">) {
  if (ann.clubId) return clubAudience(ctx, ann.clubId);

  const users = await activeUsers(ctx);
  return users
    .filter((user) => {
      const gradeOk =
        ann.targetGrades.length === 0 && ann.targetGrade == null
          ? true
          : user.gradeLevel != null &&
            (ann.targetGrade === user.gradeLevel || ann.targetGrades.includes(user.gradeLevel));
      const pathwayTargets = [ann.targetPathway, ...ann.targetMajorPathways, ...ann.targetMinorPathways].filter(
        (value): value is string => !!value,
      );
      const pathwayOk =
        pathwayTargets.length === 0 ||
        (user.major != null && pathwayTargets.includes(user.major)) ||
        (user.minor != null && pathwayTargets.includes(user.minor));

      if (ann.targetType === "SCHOOL_WIDE") return true;
      if (ann.targetType === "GRADE") return gradeOk;
      if (ann.targetType === "PATHWAY") return pathwayOk;
      if (ann.targetType === "INTERSECTION") return gradeOk && pathwayOk;
      return false;
    })
    .map((user) => user._id);
}

export async function eventAudience(ctx: MutationCtx, event: Doc<"events">) {
  if (event.clubId) return clubAudience(ctx, event.clubId);
  return (await activeUsers(ctx)).map((user) => user._id);
}

export async function flexFridayAudience(ctx: MutationCtx, friday: Doc<"flexFridays">) {
  const users = friday.type === "TEACHER_PD" ? await activeUsers(ctx) : await activeStudents(ctx);
  return users
    .filter((user) => {
      if (friday.type === "ALL_STUDENT") return user.isStudent;
      if (friday.type === "GRADE_SPECIFIC") return user.gradeLevel === friday.gradeLevel;
      if (friday.type === "PATHWAY_SPECIFIC") return user.major === friday.pathway || user.minor === friday.pathway;
      if (friday.type === "TEACHER_PD") return user.isTeacherStaff || user.roles.includes("TEACHER");
      return false;
    })
    .map((user) => user._id);
}
