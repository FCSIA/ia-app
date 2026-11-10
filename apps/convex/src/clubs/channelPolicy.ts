import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { adjustClubCounts } from "./counts";

/** The posting policies a channel can be saved with; "UNIT_LEADERS" survives only on legacy rows. */
export const channelPostingPolicyInputValidator = v.union(
  v.literal("AUDIENCE"),
  v.literal("CLUB_MANAGERS"),
);
type PostingPolicy = Infer<typeof channelPostingPolicyInputValidator>;

/**
 * `visibility` is derived from the access policy, never chosen: restricted
 * channels are PRIVATE, manager-only posting makes an open channel read-only
 * for members. Every write that changes the policy recomputes it here.
 */
export function deriveChannelVisibility(input: {
  restricted: boolean;
  postingPolicy: PostingPolicy;
}) {
  if (input.restricted) return "PRIVATE" as const;
  return input.postingPolicy === "CLUB_MANAGERS"
    ? ("MEMBER_READONLY" as const)
    : ("PUBLIC" as const);
}

/** Whiteboards are on for a channel unless its managers have turned them off. */
export function channelWhiteboardsEnabled(channel: { whiteboardsEnabled?: boolean }) {
  return channel.whiteboardsEnabled !== false;
}

/**
 * The single way a channel row is created. `countChannel: false` is for
 * callers that move the club's channel counter themselves, once for a whole
 * batch or by recounting afterwards.
 */
export async function insertClubChannel(
  ctx: MutationCtx,
  channel: {
    clubId: Id<"clubs">;
    ownerUnitId?: Id<"clubUnits">;
    position: number;
    accessRoleIds?: Id<"clubRoles">[];
    accessUnitId?: Id<"clubUnits">;
    postingPolicy: PostingPolicy;
    name: string;
    description: string | undefined;
    visibility: Doc<"clubChannels">["visibility"];
    createdById: Id<"users">;
    now: number;
  },
  options: { countChannel: boolean } = { countChannel: true },
) {
  if (options.countChannel) {
    await adjustClubCounts(ctx, channel.clubId, { channels: 1 });
  }
  const { now, accessRoleIds, ...fields } = channel;
  return await ctx.db.insert("clubChannels", {
    ...fields,
    accessPolicyVersion: 2,
    accessRoleIds: accessRoleIds ?? [],
    createdAt: now,
    updatedAt: now,
  });
}
