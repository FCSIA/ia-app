import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../lib/currentUser";
import { flexAttendanceStatusValidator } from "../validators";

export const markAttendance = mutation({
  args: {
    workshopId: v.id("flexWorkshops"),
    studentId: v.id("users"),
    status: flexAttendanceStatusValidator,
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    
    if (!user.roles.includes("TEACHER") && !user.roles.includes("ADMIN") && !user.roles.includes("SUPER_ADMIN")) {
      throw new Error("Unauthorized to mark attendance");
    }

    const workshop = await ctx.db.get(args.workshopId);
    if (!workshop) throw new Error("Workshop not found");
    
    // Find the Friday for this workshop
    const workshopSession = await ctx.db
      .query("flexWorkshopSessions")
      .withIndex("by_workshopId_and_sessionId", (q) => q.eq("workshopId", args.workshopId))
      .first();
      
    if (!workshopSession) throw new Error("Workshop is not attached to any session");
    
    const session = await ctx.db.get(workshopSession.sessionId);
    if (!session) throw new Error("Session not found");

    const existingAttendance = await ctx.db
      .query("flexAttendances")
      .withIndex("by_workshopId_and_studentId", (q) =>
        q.eq("workshopId", args.workshopId).eq("studentId", args.studentId)
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

    return attendanceId;
  },
});
