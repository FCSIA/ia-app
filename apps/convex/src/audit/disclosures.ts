import { v } from "convex/values";
import { query } from "../_generated/server";
import { getMaybeCurrentAppUser, requireAnyRoleSafe } from "../../lib/currentUser";
import { matchesDateRange } from "./_lib";

const disclosureUserRefValidator = v.union(
  v.object({
    id: v.id("users"),
    firstName: v.string(),
    lastName: v.string(),
    uniqueId: v.string(),
  }),
  v.null(),
);

const disclosureEventValidator = v.object({
  id: v.id("disclosureEvents"),
  action: v.string(),
  recordCategory: v.string(),
  recipientType: v.string(),
  recipient: v.string(),
  legalBasis: v.string(),
  legitimateInterest: v.string(),
  createdAt: v.string(),
  meta: v.union(v.any(), v.null()),
  actor: disclosureUserRefValidator,
  student: disclosureUserRefValidator,
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
    action: v.optional(v.string()),
    studentId: v.optional(v.id("users")),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  returns: v.array(disclosureEventValidator),
  handler: async (ctx, args) => {
    const viewer = await getMaybeCurrentAppUser(ctx);
    if (!viewer || !requireAnyRoleSafe(viewer, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"])) {
      return [];
    }

    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const rows = args.studentId
      ? await ctx.db
          .query("disclosureEvents")
          .withIndex("by_studentId_and_createdAt", (q) =>
            q.eq("studentId", args.studentId),
          )
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("disclosureEvents")
          .withIndex("by_createdAt")
          .order("desc")
          .take(limit);

    const filtered = rows.filter((event) => {
      if (args.action && event.action !== args.action) return false;
      return matchesDateRange(event.createdAt, args.startDate, args.endDate);
    });

    return await Promise.all(
      filtered.map(async (event) => {
        const [actor, student] = await Promise.all([
          event.actorId ? ctx.db.get(event.actorId) : null,
          event.studentId ? ctx.db.get(event.studentId) : null,
        ]);

        const toUserRef = (user: typeof actor) =>
          user
            ? {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                uniqueId: user.uniqueId,
              }
            : null;

        return {
          id: event._id,
          action: event.action,
          recordCategory: event.recordCategory,
          recipientType: event.recipientType,
          recipient: event.recipient,
          legalBasis: event.legalBasis,
          legitimateInterest: event.legitimateInterest,
          createdAt: new Date(event.createdAt).toISOString(),
          meta: event.meta ?? null,
          actor: toUserRef(actor),
          student: toUserRef(student),
        };
      }),
    );
  },
});
