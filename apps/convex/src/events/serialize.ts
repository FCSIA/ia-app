import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { createDocLoader, type DocLoader } from "../../lib/docLoader";
import { schema } from "../schema";

const personValidator = v.object({
  _id: v.id("users"),
  firstName: v.string(),
  lastName: v.string(),
  preferredName: v.optional(v.string()),
  isDeveloper: v.optional(v.boolean()),
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

export async function serializeEvent(
  ctx: QueryCtx,
  event: Doc<"events">,
  loader: DocLoader = createDocLoader(ctx),
) {
  const [author, club] = await Promise.all([
    loader.get(event.authorId),
    event.clubId ? loader.get(event.clubId) : Promise.resolve(null),
  ]);

  return {
    ...event,
    author: author
      ? {
          _id: author._id,
          firstName: author.firstName,
          lastName: author.lastName,
          preferredName: author.preferredName,
          isDeveloper: author.isDeveloper,
        }
      : null,
    club: club ? { _id: club._id, name: club.name } : null,
  };
}

export async function serializeEventDetail(ctx: QueryCtx, event: Doc<"events">) {
  const loader = createDocLoader(ctx);
  const base = await serializeEvent(ctx, event, loader);
  const approvals = await ctx.db
    .query("eventApprovals")
    .withIndex("by_eventId_and_sponsorId", (q) => q.eq("eventId", event._id))
    .collect();

  const serializedApprovals = await Promise.all(
    approvals.map(async (approval) => {
      const sponsor = await loader.get(approval.sponsorId);
      return {
        ...approval,
        sponsor: sponsor
          ? {
              _id: sponsor._id,
              firstName: sponsor.firstName,
              lastName: sponsor.lastName,
              preferredName: sponsor.preferredName,
              isDeveloper: sponsor.isDeveloper,
            }
          : null,
      };
    }),
  );

  return { ...base, approvals: serializedApprovals };
}

/** Serialize a list of events, reading each distinct author and club once. */
export async function serializeEvents(ctx: QueryCtx, events: Doc<"events">[]) {
  const loader = createDocLoader(ctx);
  return Promise.all(events.map((event) => serializeEvent(ctx, event, loader)));
}
