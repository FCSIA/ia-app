import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import { flexAttendanceStatusValidator } from "../validators";
import { canManageFlexAttendance } from "./permissions";

function canMarkAttendance(user: { roles: string[] }, workshopTeacherId?: string, actorId?: string) {
  const isGlobalAttendanceManager = canManageFlexAttendance(user.roles);
  const isWorkshopTeacher = workshopTeacherId && actorId && workshopTeacherId === actorId;
  return isGlobalAttendanceManager || isWorkshopTeacher;
}

function isActiveStudent(user: { isActive: boolean; isStudent: boolean; roles: string[] }) {
  return (
    user.isActive &&
    (user.isStudent ||
      user.roles.includes("STUDENT") ||
      user.roles.includes("STUDENT_LEADER") ||
      user.roles.includes("STUDENT_ADMIN"))
  );
}

export const getRoster = query({
  args: { workshopId: v.id("flexWorkshops") },
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return null;
    const workshop = await ctx.db.get(args.workshopId);
    if (!workshop) return null;

    if (!canMarkAttendance(user, workshop.teacherId, user._id)) {
      return null;
    }

    const links = await ctx.db
      .query("flexWorkshopSessions")
      .withIndex("by_workshopId_and_sessionId", (q) => q.eq("workshopId", args.workshopId))
      .collect();
    const sessions = await Promise.all(
      links.map(async (link) => {
        const session = await ctx.db.get(link.sessionId);
        return session ? { session } : null;
      }),
    );

    const registrations = await ctx.db
      .query("flexRegistrations")
      .withIndex("by_workshopId_and_studentId", (q) => q.eq("workshopId", args.workshopId))
      .collect();
    const assignments = await ctx.db
      .query("flexAssignments")
      .withIndex("by_workshopId_and_studentId", (q) => q.eq("workshopId", args.workshopId))
      .collect();
    const attendances = await ctx.db
      .query("flexAttendances")
      .withIndex("by_workshopId_and_studentId", (q) => q.eq("workshopId", args.workshopId))
      .collect();

    const serializeStudent = async (studentId: Id<"users">) => {
      const student = await ctx.db.get(studentId);
      if (!student) return null;
      return {
        _id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        gradeLevel: student.gradeLevel,
        uniqueId: student.uniqueId,
      };
    };

    return {
      workshop,
      sessions: sessions.filter((s): s is NonNullable<typeof s> => s !== null),
      registrations: await Promise.all(
        registrations.map(async (registration) => ({
          ...registration,
          student: await serializeStudent(registration.studentId),
        })),
      ),
      assignments: await Promise.all(
        assignments.map(async (assignment) => ({
          ...assignment,
          student: await serializeStudent(assignment.studentId),
        })),
      ),
      attendances: attendances.map((attendance) => ({
        studentId: attendance.studentId,
        status: attendance.status,
        markedAt: attendance.markedAt,
        markedById: attendance.markedById,
      })),
    };
  },
});

export const markAttendance = mutation({
  args: {
    workshopId: v.id("flexWorkshops"),
    studentId: v.id("users"),
    status: flexAttendanceStatusValidator,
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const workshop = await ctx.db.get(args.workshopId);
    if (!workshop) throw new ConvexError("Workshop not found");

    if (!canMarkAttendance(user, workshop.teacherId, user._id)) {
      throw new ConvexError("Only the workshop teacher or admins may mark attendance");
    }

    const student = await ctx.db.get(args.studentId);
    if (!student || !isActiveStudent(student)) {
      throw new ConvexError("Student not found");
    }

    const workshopSession = await ctx.db
      .query("flexWorkshopSessions")
      .withIndex("by_workshopId_and_sessionId", (q) => q.eq("workshopId", args.workshopId))
      .first();

    if (!workshopSession) throw new ConvexError("Workshop is not attached to any session");

    const session = await ctx.db.get(workshopSession.sessionId);
    if (!session) throw new ConvexError("Session not found");

    const [registration, assignment] = await Promise.all([
      ctx.db
        .query("flexRegistrations")
        .withIndex("by_workshopId_and_studentId", (q) =>
          q.eq("workshopId", args.workshopId).eq("studentId", args.studentId),
        )
        .first(),
      ctx.db
        .query("flexAssignments")
        .withIndex("by_workshopId_and_studentId", (q) =>
          q.eq("workshopId", args.workshopId).eq("studentId", args.studentId),
        )
        .first(),
    ]);

    if (!registration && !assignment) {
      throw new ConvexError("Student is not on this workshop roster");
    }

    const existingAttendance = await ctx.db
      .query("flexAttendances")
      .withIndex("by_workshopId_and_studentId", (q) =>
        q.eq("workshopId", args.workshopId).eq("studentId", args.studentId),
      )
      .first();

    let attendanceId;
    if (existingAttendance) {
      await ctx.db.patch(existingAttendance._id, {
        status: args.status,
        markedById: user._id,
        markedAt: Date.now(),
        updatedAt: Date.now(),
      });
      attendanceId = existingAttendance._id;
    } else {
      attendanceId = await ctx.db.insert("flexAttendances", {
        workshopId: args.workshopId,
        studentId: args.studentId,
        flexFridayId: session.flexFridayId,
        status: args.status,
        markedById: user._id,
        markedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: "FLEX_ATTENDANCE_MARKED",
      entityId: attendanceId,
      entityType: "FLEX_ATTENDANCE",
      createdAt: Date.now(),
    });

    return attendanceId;
  },
});

export const clearAttendance = mutation({
  args: {
    workshopId: v.id("flexWorkshops"),
    studentId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const workshop = await ctx.db.get(args.workshopId);
    if (!workshop) throw new ConvexError("Workshop not found");

    if (!canMarkAttendance(user, workshop.teacherId, user._id)) {
      throw new ConvexError("Only the workshop teacher or admins may clear attendance");
    }

    const existing = await ctx.db
      .query("flexAttendances")
      .withIndex("by_workshopId_and_studentId", (q) =>
        q.eq("workshopId", args.workshopId).eq("studentId", args.studentId),
      )
      .first();

    if (!existing) return { success: true };

    await ctx.db.delete(existing._id);

    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: "FLEX_ATTENDANCE_CLEARED",
      entityId: existing._id,
      entityType: "FLEX_ATTENDANCE",
      createdAt: Date.now(),
    });

    return { success: true };
  },
});
