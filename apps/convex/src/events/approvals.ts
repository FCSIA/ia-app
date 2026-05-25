import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../lib/currentUser";

export const requestApproval = mutation({
  args: {
    eventId: v.id("events"),
    sponsorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");
    
    const approvalId = await ctx.db.insert("eventApprovals", {
      eventId: args.eventId,
      sponsorId: args.sponsorId,
      status: "PENDING",
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.eventId, {
      status: "PENDING_APPROVAL",
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: "EVENT_APPROVAL_REQUESTED",
      entityId: args.eventId,
      entityType: "EVENT",
      createdAt: Date.now(),
    });

    return approvalId;
  },
});

export const respond = mutation({
  args: {
    approvalId: v.id("eventApprovals"),
    status: v.union(v.literal("APPROVED"), v.literal("DECLINED")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const approval = await ctx.db.get(args.approvalId);
    if (!approval) throw new Error("Approval not found");
    
    // Auth: only the sponsor can approve
    if (approval.sponsorId !== user._id && !user.roles.includes("ADMIN")) {
      throw new Error("Unauthorized to respond to this approval");
    }

    await ctx.db.patch(args.approvalId, {
      status: args.status,
      note: args.note,
      decidedAt: Date.now(),
    });

    if (args.status === "APPROVED") {
      await ctx.db.patch(approval.eventId, {
        status: "APPROVED",
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.patch(approval.eventId, {
        status: "DRAFT", // Revert back to draft if declined
        updatedAt: Date.now(),
      });
    }

    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: args.status === "APPROVED" ? "EVENT_APPROVED" : "EVENT_DECLINED",
      entityId: approval.eventId,
      entityType: "EVENT",
      createdAt: Date.now(),
    });
  },
});
