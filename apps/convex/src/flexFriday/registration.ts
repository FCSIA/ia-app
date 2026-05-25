import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../lib/currentUser";

export const register = mutation({
  args: {
    workshopId: v.id("flexWorkshops"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    
    // Validate student roles
    if (!user.roles.includes("STUDENT") && !user.roles.includes("STUDENT_LEADER") && !user.roles.includes("STUDENT_ADMIN")) {
      throw new Error("Only students can register for workshops");
    }

    const workshop = await ctx.db.get(args.workshopId);
    if (!workshop) throw new Error("Workshop not found");

    // Check existing registration
    const existingRegistration = await ctx.db
      .query("flexRegistrations")
      .withIndex("by_workshopId_and_studentId", (q) =>
        q.eq("workshopId", args.workshopId).eq("studentId", user._id)
      )
      .first();

    if (existingRegistration) {
      throw new Error("Already registered for this workshop");
    }

    // Capacity check
    if (workshop.capacity !== undefined) {
      const currentRegistrations = await ctx.db
        .query("flexRegistrations")
        .withIndex("by_workshopId_and_studentId", (q) => q.eq("workshopId", args.workshopId))
        .collect();
        
      const currentAssignments = await ctx.db
        .query("flexAssignments")
        .withIndex("by_workshopId_and_studentId", (q) => q.eq("workshopId", args.workshopId))
        .collect();

      if (currentRegistrations.length + currentAssignments.length >= workshop.capacity) {
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

export const assign = mutation({
  args: {
    workshopId: v.id("flexWorkshops"),
    studentId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    
    if (!user.roles.includes("TEACHER") && !user.roles.includes("ADMIN") && !user.roles.includes("SUPER_ADMIN")) {
      throw new Error("Unauthorized to assign students");
    }

    const workshop = await ctx.db.get(args.workshopId);
    if (!workshop) throw new Error("Workshop not found");

    // Assignments can bypass capacity if needed, but we should still check if they're already assigned/registered
    const existingRegistration = await ctx.db
      .query("flexRegistrations")
      .withIndex("by_workshopId_and_studentId", (q) =>
        q.eq("workshopId", args.workshopId).eq("studentId", args.studentId)
      )
      .first();

    if (existingRegistration) {
      throw new Error("Student is already registered for this workshop");
    }

    const existingAssignment = await ctx.db
      .query("flexAssignments")
      .withIndex("by_workshopId_and_studentId", (q) =>
        q.eq("workshopId", args.workshopId).eq("studentId", args.studentId)
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
