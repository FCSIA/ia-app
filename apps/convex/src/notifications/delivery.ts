import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { NotificationCategory } from "../validators";
import {
  preferenceAllowsPush,
  resolveNotificationPreference,
} from "./deliveryPreference";

export type NotificationSubject =
  | { kind: "announcement"; announcementId: Id<"announcements">; clubId?: Id<"clubs"> }
  | { kind: "event"; eventId: Id<"events">; clubId?: Id<"clubs"> }
  | { kind: "club"; clubId: Id<"clubs"> }
  | { kind: "clubChannel"; clubId: Id<"clubs">; channelId: Id<"clubChannels"> }
  | { kind: "clubMessage"; clubId: Id<"clubs">; channelId: Id<"clubChannels">; messageId: Id<"clubChannelMessages"> }
  | { kind: "flexFriday"; flexFridayId: Id<"flexFridays"> }
  | { kind: "moderationReport"; reportId: Id<"moderationReports"> }
  | { kind: "friendRequest"; friendshipId: Id<"studentScheduleFriends"> }
  | { kind: "friendSchedule"; friendUserId: Id<"users"> }
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
  const clubScopeKey =
    "clubId" in input.subject && input.subject.clubId
      ? `club:${input.subject.clubId}`
      : undefined;
  const decision = await deliveryDecision(
    ctx,
    input.userId,
    input.category,
    scope.scopeKey,
    clubScopeKey,
  );
  if (!decision.create) {
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

  if (decision.push) {
    await ctx.scheduler.runAfter(0, internal.notifications.pushNode.sendForDelivery, {
      userId: input.userId,
      category: input.category,
      title: input.title,
      body: input.body,
      href: input.href,
      scopeKey: scope.scopeKey,
    });
    await ctx.scheduler.runAfter(0, internal.notifications.pushExpo.sendForDelivery, {
      userId: input.userId,
      category: input.category,
      title: input.title,
      body: input.body,
      href: input.href,
      scopeKey: scope.scopeKey,
    });
  }
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

async function deliveryDecision(
  ctx: MutationCtx,
  userId: Id<"users">,
  category: NotificationCategory,
  scopeKey: string,
  clubScopeKey?: string,
) {
  if (clubScopeKey) {
    const clubPreference = await resolveNotificationPreference(ctx, {
      userId,
      category: "CLUB_ANNOUNCEMENT",
      scopeKey: clubScopeKey,
    });
    if (clubPreference && (!clubPreference.enabled || clubPreference.level === "OFF")) {
      return { create: false, push: false };
    }
  }

  const preference = await resolveNotificationPreference(ctx, { userId, category, scopeKey });
  if (preference) {
    return {
      create: preference.enabled && preference.level !== "OFF",
      push: preferenceAllowsPush(preference),
    };
  }
  return { create: category !== "CLUB_CHANNEL_MESSAGE", push: false };
}

export async function activeUsers(ctx: MutationCtx) {
  return await ctx.db
    .query("users")
    .withIndex("by_isActive", (q) => q.eq("isActive", true))
    .take(5000);
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
    .withIndex("by_clubId", (q) => q.eq("clubId", clubId))
    .collect();
  return uniqueIds([...members.map((row) => row.userId), ...sponsors.map((row) => row.userId)]);
}

export async function channelAudience(ctx: MutationCtx, channel: Doc<"clubChannels">) {
  if (channel.visibility === "PRIVATE") {
    const members = await ctx.db
      .query("clubChannelMemberships")
      .withIndex("by_channelId", (q) => q.eq("channelId", channel._id))
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
