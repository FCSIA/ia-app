import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { deliverNotification } from "../notifications/delivery";
import type { ScheduleLunchPeriod, ScheduleWeekday } from "../validators";
import { getScheduleForUser, isStudentUser } from "./_lib";

export type MaterialScheduleEntry = {
  weekday: ScheduleWeekday;
  periodNumber: number;
  courseId: Id<"courses"> | null;
  className: string;
};

export type MaterialScheduleSnapshot = {
  isPublic: boolean;
  lunchPeriod: ScheduleLunchPeriod | null;
  entries: readonly MaterialScheduleEntry[];
};

function canonicalEntries(entries: readonly MaterialScheduleEntry[]) {
  return entries
    .map((entry) => ({
      weekday: entry.weekday,
      periodNumber: entry.periodNumber,
      courseId: entry.courseId,
      className: entry.className.trim().replace(/\s+/g, " "),
    }))
    .sort(
      (left, right) =>
        left.weekday.localeCompare(right.weekday) ||
        left.periodNumber - right.periodNumber ||
        String(left.courseId).localeCompare(String(right.courseId)) ||
        left.className.localeCompare(right.className),
    );
}

export function scheduleMateriallyChanged(
  previous: MaterialScheduleSnapshot | null,
  next: MaterialScheduleSnapshot,
) {
  if (
    !previous ||
    previous.isPublic !== next.isPublic ||
    previous.lunchPeriod !== next.lunchPeriod
  ) {
    return true;
  }
  return JSON.stringify(canonicalEntries(previous.entries)) !== JSON.stringify(canonicalEntries(next.entries));
}

export function shouldNotifyFriendsOfScheduleChange(
  previous: MaterialScheduleSnapshot | null,
  next: MaterialScheduleSnapshot,
) {
  return next.isPublic && scheduleMateriallyChanged(previous, next);
}

export function uniquePageFriendIds(
  actorId: Id<"users">,
  candidateIds: readonly Id<"users">[],
) {
  return Array.from(new Set(candidateIds.filter((userId) => userId !== actorId)));
}

export async function enqueueFriendScheduleChangeNotifications(
  ctx: MutationCtx,
  input: {
    user: Doc<"users">;
    previous: MaterialScheduleSnapshot | null;
    next: MaterialScheduleSnapshot;
    scheduleUpdatedAt: number;
  },
) {
  if (!shouldNotifyFriendsOfScheduleChange(input.previous, input.next)) return 0;
  await Promise.all([
    ctx.scheduler.runAfter(0, internal.schedule.scheduleChangeNotifications.fanout, {
      userId: input.user._id,
      scheduleUpdatedAt: input.scheduleUpdatedAt,
      direction: "OUTGOING",
      cursor: null,
    }),
    ctx.scheduler.runAfter(0, internal.schedule.scheduleChangeNotifications.fanout, {
      userId: input.user._id,
      scheduleUpdatedAt: input.scheduleUpdatedAt,
      direction: "INCOMING",
      cursor: null,
    }),
  ]);
  return 2;
}

export const fanout = internalMutation({
  args: {
    userId: v.id("users"),
    scheduleUpdatedAt: v.number(),
    direction: v.union(v.literal("OUTGOING"), v.literal("INCOMING")),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user?.isActive || !isStudentUser(user)) return null;
    const schedule = await getScheduleForUser(ctx, user._id);
    if (!schedule?.isPublic || schedule.updatedAt !== args.scheduleUpdatedAt) return null;

    const friendships =
      args.direction === "OUTGOING"
        ? await ctx.db
            .query("studentScheduleFriends")
            .withIndex("by_requesterId_and_status_and_acceptedAt", (q) =>
              q.eq("requesterId", user._id).eq("status", "ACCEPTED"),
            )
            .paginate({ numItems: 50, cursor: args.cursor })
        : await ctx.db
            .query("studentScheduleFriends")
            .withIndex("by_addresseeId_and_status_and_acceptedAt", (q) =>
              q.eq("addresseeId", user._id).eq("status", "ACCEPTED"),
            )
            .paginate({ numItems: 50, cursor: args.cursor });
    const friendIds = uniquePageFriendIds(
      user._id,
      friendships.page.map((friendship) =>
        args.direction === "OUTGOING" ? friendship.addresseeId : friendship.requesterId,
      ),
    );
    for (const friendId of friendIds) {
      const friend = await ctx.db.get(friendId);
      if (!friend?.isActive || !isStudentUser(friend)) continue;
      await deliverNotification(ctx, {
        userId: friendId,
        category: "FRIEND_SCHEDULE_CHANGE",
        title: `${user.firstName} updated their schedule`,
        body: "A friend updated their shared schedule.",
        href: `/schedule?tab=friends&friend=${user._id}`,
        subject: { kind: "friendSchedule", friendUserId: user._id },
      });
    }

    if (!friendships.isDone) {
      await ctx.scheduler.runAfter(0, internal.schedule.scheduleChangeNotifications.fanout, {
        userId: user._id,
        scheduleUpdatedAt: args.scheduleUpdatedAt,
        direction: args.direction,
        cursor: friendships.continueCursor,
      });
    }
    return null;
  },
});
