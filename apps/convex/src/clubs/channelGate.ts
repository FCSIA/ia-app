import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getChannelViewerContext, getClubContext, type ClubContext } from "./access";
import { getChannelAccess, type ChannelAccess } from "./channelAccess";

type GateCtx = QueryCtx | MutationCtx;

type ChannelGate =
  | { status: "channel-not-found" }
  | { status: "club-not-found" }
  | { status: "club-inactive" }
  | {
      status: "resolved";
      channel: Doc<"clubChannels">;
      club: Doc<"clubs">;
      context: ClubContext;
      access: ChannelAccess;
    };

/**
 * The one place a viewer is resolved against a channel: channel, club, club
 * standing, then channel access. Callers decide what a missing or unreadable
 * channel means for them. Reads hide channels of deactivated clubs
 * (`requireActiveClub`); some writes and reports have always ignored that.
 */
export async function resolveChannel(
  ctx: GateCtx,
  user: Doc<"users">,
  channelId: Id<"clubChannels">,
  options: { requireActiveClub: boolean; clubId?: Id<"clubs">; channel?: Doc<"clubChannels"> },
): Promise<ChannelGate> {
  const channel = options.channel ?? (await ctx.db.get(channelId));
  if (!channel || (options.clubId && channel.clubId !== options.clubId)) {
    return { status: "channel-not-found" };
  }
  const club = await ctx.db.get(channel.clubId);
  if (!club) return { status: "club-not-found" };
  if (options.requireActiveClub && !club.isActive) {
    return { status: "club-inactive" };
  }
  const context = await getChannelViewerContext(ctx, club, user);
  const access = await getChannelAccess(ctx, channel, context, user._id);
  return { status: "resolved", channel, club, context, access };
}

/** Query access: the channel and viewer state, or null when the viewer cannot read it. */
export async function getReadableChannel(
  ctx: GateCtx,
  user: Doc<"users">,
  clubId: Id<"clubs">,
  channelId: Id<"clubChannels">,
) {
  const gate = await resolveChannel(ctx, user, channelId, {
    clubId,
    requireActiveClub: true,
  });
  if (gate.status !== "resolved" || !gate.access.canView) return null;
  return gate;
}

/**
 * Mutation access for club members. Throws unless the channel exists and the
 * caller belongs to its club; the caller still checks the specific
 * `access.canView` / `access.canPost` it needs.
 */
export async function requireChannelMemberGate(
  ctx: GateCtx,
  user: Doc<"users">,
  channelId: Id<"clubChannels">,
) {
  const gate = await resolveChannel(ctx, user, channelId, {
    requireActiveClub: false,
  });
  if (gate.status === "channel-not-found") {
    throw new ConvexError("Channel not found");
  }
  if (gate.status !== "resolved") throw new ConvexError("Club not found");
  if (!gate.context.canAccessWorkspace) {
    throw new ConvexError("Not a club member");
  }
  return gate;
}

/**
 * Mutation access for channel settings: needs a club permission, not channel
 * access. Throws "Channel not found" or `deniedMessage`.
 */
export async function requireChannelManager(
  ctx: MutationCtx,
  user: Doc<"users">,
  channelId: Id<"clubChannels">,
  permission: "editChannels" | "deleteChannels",
  deniedMessage: string,
) {
  const channel = await ctx.db.get(channelId);
  if (!channel) throw new ConvexError("Channel not found");
  const context = await getClubContext(ctx, channel.clubId, user);
  if (!context.permissions[permission]) throw new ConvexError(deniedMessage);
  return { channel, context };
}
