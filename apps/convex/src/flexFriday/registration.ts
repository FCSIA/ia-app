import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";

function isStudent(user: { roles: string[] }) {
  return (
    user.roles.includes("STUDENT") ||
    user.roles.includes("STUDENT_LEADER") ||
    user.roles.includes("STUDENT_ADMIN")
  );
}

export const getMyRegistrations = query({
  args: {},
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    const registrations = await ctx.db
      .query("flexRegistrations")
      .withIndex("by_studentId", (q) => q.eq("studentId", user._id))
      .collect();

    return Promise.all(
      registrations.map(async (registration) => {
        const workshop = await ctx.db.get(registration.workshopId);
        if (!workshop) {
          return { ...registration, workshop: null };
        }

        const links = await ctx.db
          .query("flexWorkshopSessions")
          .withIndex("by_workshopId_and_sessionId", (q) =>
            q.eq("workshopId", workshop._id),
          )
          .collect();

        const sessions = await Promise.all(
          links.map(async (link) => {
            const session = await ctx.db.get(link.sessionId);
            if (!session) return null;
            const flexFriday = await ctx.db.get(session.flexFridayId);
            return {
              session: {
                ...session,
                flexFriday,
              },
            };
          }),
        );

        return {
          ...registration,
          workshop: {
            ...workshop,
            sessions: sessions.filter((s): s is NonNullable<typeof s> => s !== null),
          },
        };
      }),
    );
  },
});

export const getMyAssignments = query({
  args: {},
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    const assignments = await ctx.db
      .query("flexAssignments")
      .withIndex("by_studentId", (q) => q.eq("studentId", user._id))
      .collect();

    return Promise.all(
      assignments.map(async (assignment) => {
        const workshop = await ctx.db.get(assignment.workshopId);
        if (!workshop) {
          return { ...assignment, workshop: null };
        }

        const links = await ctx.db
          .query("flexWorkshopSessions")
          .withIndex("by_workshopId_and_sessionId", (q) =>
            q.eq("workshopId", workshop._id),
          )
          .collect();

        const sessions = await Promise.all(
          links.map(async (link) => {
            const session = await ctx.db.get(link.sessionId);
            if (!session) return null;
            const flexFriday = await ctx.db.get(session.flexFridayId);
            return {
              session: {
                ...session,
                flexFriday,
              },
            };
          }),
        );

        return {
          ...assignment,
          workshop: {
            ...workshop,
            sessions: sessions.filter((s): s is NonNullable<typeof s> => s !== null),
          },
        };
      }),
    );
  },
});

export const register = mutation({
  args: {
    workshopId: v.id("flexWorkshops"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);

    if (!isStudent(user)) {
      throw new Error("Only students can register for workshops");
    }

    const workshop = await ctx.db.get(args.workshopId);
    if (!workshop) throw new Error("Workshop not found");

    const existingRegistration = await ctx.db
      .query("flexRegistrations")
      .withIndex("by_workshopId_and_studentId", (q) =>
        q.eq("workshopId", args.workshopId).eq("studentId", user._id),
      )
      .first();

    if (existingRegistration) {
      throw new Error("Already registered for this workshop");
    }

    const workshopLinks = await ctx.db
      .query("flexWorkshopSessions")
      .withIndex("by_workshopId_and_sessionId", (q) => q.eq("workshopId", args.workshopId))
      .collect();
    const sessionIds = workshopLinks.map((l) => l.sessionId);
    if (sessionIds.length === 0) {
      throw new Error("Workshop is not attached to any sessions");
    }

    const myRegs = await ctx.db
      .query("flexRegistrations")
      .withIndex("by_studentId", (q) => q.eq("studentId", user._id))
      .collect();

    for (const reg of myRegs) {
      const otherLinks = await ctx.db
        .query("flexWorkshopSessions")
        .withIndex("by_workshopId_and_sessionId", (q) => q.eq("workshopId", reg.workshopId))
        .collect();
      if (otherLinks.some((l) => sessionIds.includes(l.sessionId))) {
        throw new Error("Already registered for a workshop in one of these sessions");
      }
    }

    if (workshop.capacity !== undefined) {
      if (workshop.capacity < 1) {
        throw new Error("Workshop is at full capacity");
      }
      const capacityCheckLimit = workshop.capacity + 1;
      const currentRegistrations = await ctx.db
        .query("flexRegistrations")
        .withIndex("by_workshopId_and_studentId", (q) => q.eq("workshopId", args.workshopId))
        .take(capacityCheckLimit);
      const currentAssignments = await ctx.db
        .query("flexAssignments")
        .withIndex("by_workshopId_and_studentId", (q) => q.eq("workshopId", args.workshopId))
        .take(capacityCheckLimit);

      if (
        currentRegistrations.length + currentAssignments.length >=
        workshop.capacity
      ) {
        throw new Error("Workshop is at full capacity");
      }
    }

    const registrationId = await ctx.db.insert("flexRegistrations", {
      workshopId: args.workshopId,
      studentId: user._id,
      createdAt: Date.now(),
    });

    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: "FLEX_WORKSHOP_REGISTERED",
      entityId: registrationId,
      entityType: "FLEX_REGISTRATION",
      createdAt: Date.now(),
    });

    return registrationId;
  },
});

export const unregister = mutation({
  args: { workshopId: v.id("flexWorkshops") },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);

    const registration = await ctx.db
      .query("flexRegistrations")
      .withIndex("by_workshopId_and_studentId", (q) =>
        q.eq("workshopId", args.workshopId).eq("studentId", user._id),
      )
      .first();

    if (!registration) throw new Error("Registration not found");

    await ctx.db.delete(registration._id);

    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: "FLEX_REGISTRATION_REMOVED",
      entityId: registration._id,
      entityType: "FLEX_REGISTRATION",
      createdAt: Date.now(),
    });
  },
});

export const assign = mutation({
  args: {
    workshopId: v.id("flexWorkshops"),
    studentId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);

    if (
      !user.roles.includes("TEACHER") &&
      !user.roles.includes("ADMIN") &&
      !user.roles.includes("SUPER_ADMIN")
    ) {
      throw new Error("Unauthorized to assign students");
    }

    const workshop = await ctx.db.get(args.workshopId);
    if (!workshop) throw new Error("Workshop not found");

    const existingRegistration = await ctx.db
      .query("flexRegistrations")
      .withIndex("by_workshopId_and_studentId", (q) =>
        q.eq("workshopId", args.workshopId).eq("studentId", args.studentId),
      )
      .first();

    if (existingRegistration) {
      throw new Error("Student is already registered for this workshop");
    }

    const existingAssignment = await ctx.db
      .query("flexAssignments")
      .withIndex("by_workshopId_and_studentId", (q) =>
        q.eq("workshopId", args.workshopId).eq("studentId", args.studentId),
      )
      .first();

    if (existingAssignment) {
      throw new Error("Student is already assigned to this workshop");
    }

    const assignmentId = await ctx.db.insert("flexAssignments", {
      workshopId: args.workshopId,
      studentId: args.studentId,
      assignedBy: user._id,
      createdAt: Date.now(),
    });

    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: "FLEX_WORKSHOP_ASSIGNED",
      entityId: assignmentId,
      entityType: "FLEX_ASSIGNMENT",
      createdAt: Date.now(),
    });

    return assignmentId;
  },
});
