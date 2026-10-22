import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { getCurrentAppUser } from "../../lib/currentUser";
import {
  canApproveAnnouncement,
  isGlobalAnnouncementApprover,
} from "../announcements/_lib";
import { canReviewFeedback } from "../moderation/feedbackAccess";

const itemValidator = v.object({
  id: v.string(),
  title: v.string(),
  href: v.string(),
  createdAt: v.number(),
  kind: v.union(
    v.literal("announcement"),
    v.literal("event"),
    v.literal("invite"),
    v.literal("club-invite"),
    v.literal("changes"),
    v.literal("reports"),
    v.literal("feedback"),
  ),
});

/** Bounded queues expose their lower bound honestly rather than claiming empty. */
export const list = query({
  args: {},
  returns: v.object({
    items: v.array(itemValidator),
    total: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    const cap = 100;
    const items: {
      id: string;
      title: string;
      href: string;
      createdAt: number;
      kind:
        | "announcement"
        | "event"
        | "invite"
        | "club-invite"
        | "changes"
        | "reports"
        | "feedback";
    }[] = [];
    let hasMore = false;
    const add = (row: (typeof items)[number]) => {
      if (!items.some((item) => item.id === row.id)) items.push(row);
    };
    let pending: Doc<"announcements">[];
    if (isGlobalAnnouncementApprover(user.roles)) {
      pending = await ctx.db
        .query("announcements")
        .withIndex("by_status", (q) => q.eq("status", "PENDING_APPROVAL"))
        .take(cap + 1);
    } else {
      const sponsors = await ctx.db
        .query("clubSponsors")
        .withIndex("by_userId_and_clubId", (q) => q.eq("userId", user._id))
        .take(cap + 1);
      hasMore ||= sponsors.length > cap;
      pending = [];
      for (const sponsor of sponsors.slice(0, cap)) {
        const remaining: number = cap + 1 - pending.length;
        if (remaining <= 0) {
          hasMore = true;
          break;
        }
        pending.push(
          ...(await ctx.db
            .query("announcements")
            .withIndex("by_clubId_and_status", (q) =>
              q.eq("clubId", sponsor.clubId).eq("status", "PENDING_APPROVAL"),
            )
            .take(remaining)),
        );
      }
    }
    hasMore ||= pending.length > cap;
    for (const post of pending.slice(0, cap)) {
      if (await canApproveAnnouncement(ctx, post, user))
        add({
          id: `announcement:${post._id}`,
          kind: "announcement",
          title: post.title,
          href: `/announcements/${post._id}`,
          createdAt: post.createdAt,
        });
    }
    const [approvals, invites, rejected, clubInvites] = await Promise.all([
      ctx.db
        .query("eventApprovals")
        .withIndex("by_sponsorId_and_status", (q) =>
          q.eq("sponsorId", user._id).eq("status", "PENDING"),
        )
        .take(cap + 1),
      ctx.db
        .query("calendarInvites")
        .withIndex("by_recipientId_and_status_and_createdAt", (q) =>
          q.eq("recipientId", user._id).eq("status", "PENDING"),
        )
        .take(cap + 1),
      ctx.db
        .query("announcements")
        .withIndex("by_authorId_and_status", (q) =>
          q.eq("authorId", user._id).eq("status", "REJECTED"),
        )
        .take(cap + 1),
      ctx.db
        .query("clubInvites")
        .withIndex("by_recipientId_and_status_and_updatedAt", (q) =>
          q.eq("recipientId", user._id).eq("status", "PENDING"),
        )
        .take(cap + 1),
    ]);
    hasMore ||= [approvals, invites, rejected, clubInvites].some(
      (rows) => rows.length > cap,
    );
    for (const approval of approvals.slice(0, cap)) {
      const event = await ctx.db.get(approval.eventId);
      if (event?.status === "PENDING_APPROVAL")
        add({
          id: `event:${event._id}`,
          kind: "event",
          title: event.title,
          href: `/events/${event._id}`,
          createdAt: approval.createdAt,
        });
    }
    for (const invite of invites.slice(0, cap)) {
      const entry = await ctx.db.get(invite.calendarEntryId);
      if (entry)
        add({
          id: `invite:${invite._id}`,
          kind: "invite",
          title: entry.title,
          href: "/calendar",
          createdAt: invite.createdAt,
        });
    }
    for (const invite of clubInvites.slice(0, cap)) {
      const club = await ctx.db.get(invite.clubId);
      if (club?.isActive)
        add({
          id: `club-invite:${invite._id}`,
          kind: "club-invite",
          title: club.name,
          href: `/clubs/${club._id}`,
          createdAt: invite.createdAt,
        });
    }
    for (const post of rejected.slice(0, cap))
      add({
        id: `changes:${post._id}`,
        kind: "changes",
        title: post.title,
        href: `/announcements/${post._id}`,
        createdAt: post.updatedAt,
      });
    if (
      user.roles.some((role) => ["ADMIN", "SUPER_ADMIN"].includes(role)) ||
      canReviewFeedback(user)
    ) {
      const reports = await ctx.db
        .query("moderationReports")
        .withIndex("by_status_and_createdAt", (q) => q.eq("status", "PENDING"))
        .take(cap + 1);
      hasMore ||= reports.length > cap;
      for (const report of reports.slice(0, cap)) {
        const feedback = report.contentType === "GENERAL";
        if (
          feedback
            ? !canReviewFeedback(user)
            : !user.roles.some((role) =>
                ["ADMIN", "SUPER_ADMIN"].includes(role),
              )
        )
          continue;
        add({
          id: `report:${report._id}`,
          kind: feedback ? "feedback" : "reports",
          title: report.reason,
          href: `/admin?tab=${feedback ? "feedback" : "reports"}`,
          createdAt: report.createdAt,
        });
      }
    }
    items.sort((a, b) => b.createdAt - a.createdAt);
    return { items: items.slice(0, 6), total: items.length, hasMore };
  },
});
