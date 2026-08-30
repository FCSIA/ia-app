import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { schema } from "../schema";

const personValidator = v.object({
  _id: v.id("users"),
  firstName: v.string(),
  lastName: v.string(),
});
export const serializedEventValidator = schema.doc("events").extend({
  author: v.union(personValidator, v.null()),
  club: v.union(v.object({ _id: v.id("clubs"), name: v.string() }), v.null()),
});
export const serializedEventDetailValidator = serializedEventValidator.extend({
  approvals: v.array(
    schema.doc("eventApprovals").extend({
      sponsor: v.union(personValidator, v.null()),
    }),
  ),
});

export async function serializeEvent(ctx: QueryCtx, event: Doc<"events">) {
  const author = await ctx.db.get(event.authorId);
  const club = event.clubId ? await ctx.db.get(event.clubId) : null;

  return {
    ...event,
    author: author
      ? {
          _id: author._id,
          firstName: author.firstName,
          lastName: author.lastName,
        }
      : null,
    club: club ? { _id: club._id, name: club.name } : null,
  };
}

export async function serializeEventDetail(
  ctx: QueryCtx,
  event: Doc<"events">,
) {
  const base = await serializeEvent(ctx, event);
  const approvals = await ctx.db
    .query("eventApprovals")
    .withIndex("by_eventId_and_sponsorId", (q) => q.eq("eventId", event._id))
    .collect();

  const serializedApprovals = await Promise.all(
    approvals.map(async (approval) => {
      const sponsor = await ctx.db.get(approval.sponsorId);
      return {
        ...approval,
        sponsor: sponsor
          ? {
              _id: sponsor._id,
              firstName: sponsor.firstName,
              lastName: sponsor.lastName,
            }
          : null,
      };
    }),
  );

  return { ...base, approvals: serializedApprovals };
}
