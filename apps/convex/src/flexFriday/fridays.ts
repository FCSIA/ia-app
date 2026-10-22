import { logAuditEvent } from "../audit/_lib";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import { flexFridayValidator } from "./_lib";
import { flexSessionTypeValidator } from "../validators";
import { deliverMany, flexFridayAudience } from "../notifications/delivery";
import { canCreateFlexFriday } from "./permissions";
import { countFlexSessions } from "./counts";

function parseFridayDate(date: string | number): number {
  if (typeof date === "number") return date;
  return new Date(`${date}T12:00:00`).getTime();
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    const fridays = await ctx.db.query("flexFridays").order("desc").take(50);

    return Promise.all(
      fridays.map(async (friday) => ({
        ...friday,
        _count: {
          // Fridays written before the counter existed still have to be counted;
          // `backfillFlexSessionCount` is what retires that last scan.
          sessions: friday.sessionCount ?? (await countFlexSessions(ctx, friday._id)),
        },
      })),
    );
  },
});

export const create = mutation({
  args: {
    date: v.union(v.string(), v.number()),
    type: flexFridayValidator.type,
    gradeLevel: v.optional(v.number()),
    pathway: flexFridayValidator.pathway,
    isSchoolDay: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    sessions: v.optional(
      v.array(
        v.object({
          title: v.string(),
          description: v.optional(v.string()),
          startTime: v.string(),
          endTime: v.string(),
          sessionType: flexSessionTypeValidator,
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);

    if (!canCreateFlexFriday(user.roles)) {
      throw new Error("Unauthorized");
    }

    const date = parseFridayDate(args.date);
    const sessions = args.sessions ?? [];
    const fridayId = await ctx.db.insert("flexFridays", {
      date,
      type: args.type,
      gradeLevel: args.gradeLevel,
      pathway: args.pathway,
      isSchoolDay: args.isSchoolDay ?? true,
      notes: args.notes?.trim(),
      // A new Friday owns exactly the sessions created with it, so the counter
      // is known outright rather than adjusted.
      sessionCount: sessions.length,
      createdAt: Date.now(),
    });

    for (const session of sessions) {
      await ctx.db.insert("flexSessions", {
        flexFridayId: fridayId,
        ...session,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    await ctx.db.insert("calendarEntries", {
      flexFridayId: fridayId,
      title: "Flex Friday",
      description: args.notes?.trim(),
      startAt: date,
      endAt: date,
      tags: ["flex-friday"],
      source: "SCHOOL",
      createdById: user._id,
      createdAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "FLEX_FRIDAY_CREATED",
      entityId: fridayId,
      entityType: "FLEX_FRIDAY",
    });

    const friday = await ctx.db.get(fridayId);
    if (friday) {
      await deliverMany(ctx, await flexFridayAudience(ctx, friday), {
        category: "FLEX_FRIDAY",
        title: "Flex Friday scheduled",
        body: args.notes?.trim() || "A new Flex Friday has been added.",
        href: "/flex-friday",
        subject: { kind: "flexFriday", flexFridayId: friday._id },
      });
    }

    return fridayId;
  },
});
