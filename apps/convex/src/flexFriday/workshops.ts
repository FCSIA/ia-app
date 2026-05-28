import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import { pathwayValidator } from "../validators";

function canManageWorkshops(user: { roles: string[] }) {
  return (
    user.roles.includes("TEACHER") ||
    user.roles.includes("ADMIN") ||
    user.roles.includes("SUPER_ADMIN")
  );
}

async function serializeWorkshopForSession(
  ctx: QueryCtx,
  workshopId: Id<"flexWorkshops">,
  sessionId: Id<"flexSessions">,
  viewerId: Id<"users"> | null,
) {
  const workshop = await ctx.db.get(workshopId);
  if (!workshop) return null;

  const registrations = await ctx.db
    .query("flexRegistrations")
    .withIndex("by_workshopId_and_studentId", (q) => q.eq("workshopId", workshopId))
    .collect();
  const assignments = await ctx.db
    .query("flexAssignments")
    .withIndex("by_workshopId_and_studentId", (q) => q.eq("workshopId", workshopId))
    .collect();

  const links = await ctx.db
    .query("flexWorkshopSessions")
    .withIndex("by_workshopId_and_sessionId", (q) => q.eq("workshopId", workshopId))
    .collect();

  const linkedSessions = await Promise.all(
    links.map(async (link) => {
      const session = await ctx.db.get(link.sessionId);
      if (!session) return null;
      return {
        _id: session._id,
        title: session.title,
        startTime: session.startTime,
        endTime: session.endTime,
      };
    }),
  );

  return {
    ...workshop,
    _count: { registrations: registrations.length },
    registrations: registrations
      .filter((r) => viewerId && r.studentId === viewerId)
      .map((r) => ({ _id: r._id })),
    assignments: assignments
      .filter((a) => viewerId && a.studentId === viewerId)
      .map((a) => ({ _id: a._id })),
    linkedSessions: linkedSessions.filter(
      (s): s is NonNullable<typeof s> => s !== null,
    ),
    sessionId,
  };
}

export const listBySession = query({
  args: {
    flexFridayId: v.id("flexFridays"),
    sessionId: v.id("flexSessions"),
  },
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.flexFridayId !== args.flexFridayId) {
      return [];
    }

    const links = await ctx.db
      .query("flexWorkshopSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const workshops = await Promise.all(
      links.map((link) =>
        serializeWorkshopForSession(ctx, link.workshopId, args.sessionId, user?._id ?? null),
      ),
    );

    return workshops.filter((w): w is NonNullable<typeof w> => w !== null);
  },
});

export const create = mutation({
  args: {
    flexFridayId: v.id("flexFridays"),
    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    capacity: v.optional(v.number()),
    sessionIds: v.array(v.id("flexSessions")),
    targetGrades: v.optional(v.array(v.number())),
    targetMajorPathways: v.optional(v.array(pathwayValidator)),
    targetMinorPathways: v.optional(v.array(pathwayValidator)),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!canManageWorkshops(user)) throw new Error("Unauthorized");

    if (args.sessionIds.length === 0) {
      throw new Error("Workshop must be attached to at least one session");
    }

    const sessions = await Promise.all(args.sessionIds.map((id) => ctx.db.get(id)));
    if (sessions.some((s) => !s || s.flexFridayId !== args.flexFridayId)) {
      throw new Error("All sessions must belong to this Flex Friday");
    }

    const workshopId = await ctx.db.insert("flexWorkshops", {
      teacherId: user._id,
      title: args.title.trim(),
      description: args.description?.trim(),
      location: args.location?.trim(),
      capacity: args.capacity,
      targetGrades: args.targetGrades ?? [],
      targetMajorPathways: args.targetMajorPathways ?? [],
      targetMinorPathways: args.targetMinorPathways ?? [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    for (const sessionId of args.sessionIds) {
      await ctx.db.insert("flexWorkshopSessions", {
        workshopId,
        sessionId,
        createdAt: Date.now(),
      });
    }

    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: "FLEX_WORKSHOP_CREATED",
      entityId: workshopId,
      entityType: "FLEX_WORKSHOP",
      createdAt: Date.now(),
    });

    return workshopId;
  },
});

export const update = mutation({
  args: {
    workshopId: v.id("flexWorkshops"),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    location: v.optional(v.union(v.string(), v.null())),
    capacity: v.optional(v.union(v.number(), v.null())),
    sessionIds: v.optional(v.array(v.id("flexSessions"))),
    targetGrades: v.optional(v.array(v.number())),
    targetMajorPathways: v.optional(v.array(pathwayValidator)),
    targetMinorPathways: v.optional(v.array(pathwayValidator)),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!canManageWorkshops(user)) throw new Error("Unauthorized");

    const workshop = await ctx.db.get(args.workshopId);
    if (!workshop) throw new Error("Workshop not found");

    if (args.sessionIds) {
      if (args.sessionIds.length === 0) {
        throw new Error("Workshop must be attached to at least one session");
      }
      const existingLinks = await ctx.db
        .query("flexWorkshopSessions")
        .withIndex("by_workshopId_and_sessionId", (q) => q.eq("workshopId", args.workshopId))
        .first();
      const firstSession = existingLinks
        ? await ctx.db.get(existingLinks.sessionId)
        : await ctx.db.get(args.sessionIds[0]);
      const fridayId = firstSession?.flexFridayId;

      const sessions = await Promise.all(args.sessionIds.map((id) => ctx.db.get(id)));
      if (
        !fridayId ||
        sessions.some((s) => !s || s.flexFridayId !== fridayId)
      ) {
        throw new Error("All sessions must belong to the same Flex Friday");
      }

      const oldLinks = await ctx.db
        .query("flexWorkshopSessions")
        .withIndex("by_workshopId_and_sessionId", (q) => q.eq("workshopId", args.workshopId))
        .collect();
      for (const link of oldLinks) {
        await ctx.db.delete(link._id);
      }
      for (const sessionId of args.sessionIds) {
        await ctx.db.insert("flexWorkshopSessions", {
          workshopId: args.workshopId,
          sessionId,
          createdAt: Date.now(),
        });
      }
    }

    await ctx.db.patch(args.workshopId, {
      ...(args.title !== undefined ? { title: args.title.trim() } : {}),
      ...(args.description !== undefined
        ? { description: args.description ?? undefined }
        : {}),
      ...(args.location !== undefined ? { location: args.location ?? undefined } : {}),
      ...(args.capacity !== undefined ? { capacity: args.capacity ?? undefined } : {}),
      ...(args.targetGrades !== undefined ? { targetGrades: args.targetGrades } : {}),
      ...(args.targetMajorPathways !== undefined
        ? { targetMajorPathways: args.targetMajorPathways }
        : {}),
      ...(args.targetMinorPathways !== undefined
        ? { targetMinorPathways: args.targetMinorPathways }
        : {}),
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: "FLEX_WORKSHOP_UPDATED",
      entityId: args.workshopId,
      entityType: "FLEX_WORKSHOP",
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { workshopId: v.id("flexWorkshops") },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!canManageWorkshops(user)) throw new Error("Unauthorized");

    const workshop = await ctx.db.get(args.workshopId);
    if (!workshop) throw new Error("Workshop not found");

    const links = await ctx.db
      .query("flexWorkshopSessions")
      .withIndex("by_workshopId_and_sessionId", (q) => q.eq("workshopId", args.workshopId))
      .collect();
    for (const link of links) {
      await ctx.db.delete(link._id);
    }

    const registrations = await ctx.db
      .query("flexRegistrations")
      .withIndex("by_workshopId_and_studentId", (q) => q.eq("workshopId", args.workshopId))
      .collect();
    for (const reg of registrations) {
      await ctx.db.delete(reg._id);
    }

    const assignments = await ctx.db
      .query("flexAssignments")
      .withIndex("by_workshopId_and_studentId", (q) => q.eq("workshopId", args.workshopId))
      .collect();
    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
    }

    const attendances = await ctx.db
      .query("flexAttendances")
      .withIndex("by_workshopId_and_studentId", (q) => q.eq("workshopId", args.workshopId))
      .collect();
    for (const attendance of attendances) {
      await ctx.db.delete(attendance._id);
    }

    await ctx.db.delete(args.workshopId);

    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: "FLEX_WORKSHOP_DELETED",
      entityId: args.workshopId,
      entityType: "FLEX_WORKSHOP",
      createdAt: Date.now(),
    });
  },
});
