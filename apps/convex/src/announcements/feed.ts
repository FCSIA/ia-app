import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../lib/currentUser";
import { announcementValidator, getAccessibleClubIds, getViewerAudience } from "./_lib";
import { logAuditEvent } from "../audit/_lib";
import { Doc, Id } from "../_generated/dataModel";

export const list = query({
  args: {
    archived: v.optional(v.boolean()),
    clubId: v.optional(v.id("clubs")),
    unreadOnly: v.optional(v.boolean()),
  },
  returns: v.array(announcementValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const viewer = await getViewerAudience(ctx, user._id);
    const accessibleClubIds = await getAccessibleClubIds(ctx, user._id);
    
    // TODO: implement status filtering and full audience logic based on legacy service
    const all = await ctx.db
      .query("announcements")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();

    return all.filter((ann) => {
        if (ann.status === "ACTIVE") {
            if (ann.targetType === "SCHOOL_WIDE") return true;
            if (ann.targetType === "GRADE" && viewer.gradeLevel && (ann.targetGrade === viewer.gradeLevel || ann.targetGrades.includes(viewer.gradeLevel))) return true;
            if (ann.targetType === "CLUB" && ann.clubId && (accessibleClubIds as any[]).includes(ann.clubId)) return true;
            return false;
        }
        return false;
    }).map(ann => ({ 
      ...ann, 
      status: ann.status as "PENDING_APPROVAL" | "ACTIVE" | "EXPIRED" | "ARCHIVED" | "REJECTED",
      targetType: ann.targetType as any 
    }));
    },
    });

    export const get = query({
    args: { id: v.id("announcements") },
    returns: announcementValidator,
    handler: async (ctx, args) => {
    const ann = await ctx.db.get(args.id);
    if (!ann) throw new ConvexError("Announcement not found");
    return { 
      ...ann, 
      status: ann.status as "PENDING_APPROVAL" | "ACTIVE" | "EXPIRED" | "ARCHIVED" | "REJECTED",
      targetType: ann.targetType as any
    };
    },
    });

export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    targetType: v.union(
      v.literal("SCHOOL_WIDE"),
      v.literal("GRADE"),
      v.literal("PATHWAY"),
      v.literal("CLUB"),
      v.literal("INTERSECTION"),
    ),
    targetGrade: v.optional(v.number()),
    targetGrades: v.array(v.number()),
    targetPathway: v.optional(v.string()),
    targetMajorPathways: v.array(v.string()),
    targetMinorPathways: v.array(v.string()),
    clubId: v.optional(v.id("clubs")),
    allowComments: v.boolean(),
    isAdminGeneral: v.boolean(),
    expiresAt: v.optional(v.number()),
  },
  returns: v.id("announcements"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    
    // Create the announcement
    const annId = await ctx.db.insert("announcements", {
      authorId: user._id,
      title: args.title,
      body: args.body,
      targetType: args.targetType,
      targetGrade: args.targetGrade,
      targetGrades: args.targetGrades,
      targetPathway: args.targetPathway,
      targetMajorPathways: args.targetMajorPathways,
      targetMinorPathways: args.targetMinorPathways,
      clubId: args.clubId,
      status: "ACTIVE",
      allowComments: args.allowComments,
      isAdminGeneral: args.isAdminGeneral,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    await logAuditEvent(ctx, { 
      actorId: user._id, 
      action: "announcement.created", 
      entityType: "announcement", 
      entityId: annId,
      meta: { title: args.title }
    });
    
    return annId;
  },
});

export const approve = mutation({
  args: { id: v.id("announcements") },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const ann = await ctx.db.get(args.id);
    if (!ann) throw new ConvexError("Announcement not found");
    
    if (!user.roles.includes("ADMIN")) throw new ConvexError("Unauthorized");

    await ctx.db.patch(args.id, { status: "ACTIVE", approvedAt: Date.now(), approvedById: user._id, updatedAt: Date.now() });
    await logAuditEvent(ctx, { actorId: user._id, action: "announcement.approved", entityType: "announcement", entityId: args.id });
  },
});

export const reject = mutation({
  args: { id: v.id("announcements"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const ann = await ctx.db.get(args.id);
    if (!ann) throw new ConvexError("Announcement not found");

    if (!user.roles.includes("ADMIN")) throw new ConvexError("Unauthorized");

    await ctx.db.patch(args.id, { status: "REJECTED", rejectionNote: args.note, updatedAt: Date.now() });
    await logAuditEvent(ctx, { actorId: user._id, action: "announcement.rejected", entityType: "announcement", entityId: args.id });
  },
});
