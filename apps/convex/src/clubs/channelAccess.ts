import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { ClubContext } from "./access";
import { MAX_CLUB_UNITS } from "./hierarchyRules";

type ChannelDbCtx = QueryCtx | MutationCtx;
type Channel = Doc<"clubChannels">;

export type ChannelAccess = {
  canView: boolean;
  canPost: boolean;
  canManage: boolean;
};

type EffectivePolicy = {
  audienceKind: "CLUB" | "UNIT_MEMBERS" | "UNIT_LEADERS" | "CUSTOM";
  audienceUnitId: Id<"clubUnits"> | null;
  includeDescendants: boolean;
  includeAncestorLeaders: boolean;
  postingPolicy: "AUDIENCE" | "UNIT_LEADERS" | "CLUB_MANAGERS";
};

/** Legacy visibility maps to a policy until existing rows are backfilled. */
export function effectiveChannelPolicy(channel: Channel): EffectivePolicy {
  if (channel.audienceKind && channel.postingPolicy) {
    return {
      audienceKind: channel.audienceKind,
      audienceUnitId: channel.audienceUnitId ?? null,
      includeDescendants: channel.includeDescendants ?? false,
      includeAncestorLeaders: channel.includeAncestorLeaders ?? false,
      postingPolicy: channel.postingPolicy,
    };
  }
  if (channel.visibility === "PRIVATE") {
    return {
      audienceKind: "CUSTOM",
      audienceUnitId: null,
      includeDescendants: false,
      includeAncestorLeaders: false,
      postingPolicy: "AUDIENCE",
    };
  }
  return {
    audienceKind: "CLUB",
    audienceUnitId: null,
    includeDescendants: false,
    includeAncestorLeaders: false,
    postingPolicy: channel.visibility === "MEMBER_READONLY" ? "CLUB_MANAGERS" : "AUDIENCE",
  };
}

function isUnitOrDescendant(
  unitId: Id<"clubUnits">,
  targetId: Id<"clubUnits">,
  parentByUnitId: Map<Id<"clubUnits">, Id<"clubUnits"> | null>,
) {
  let current: Id<"clubUnits"> | null = unitId;
  const visited = new Set<Id<"clubUnits">>();
  while (current) {
    if (current === targetId) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    current = parentByUnitId.get(current) ?? null;
  }
  return false;
}

function isTargetOrAncestor(
  unitId: Id<"clubUnits">,
  targetId: Id<"clubUnits">,
  parentByUnitId: Map<Id<"clubUnits">, Id<"clubUnits"> | null>,
) {
  return isUnitOrDescendant(targetId, unitId, parentByUnitId);
}

async function unitAccessInputs(
  ctx: ChannelDbCtx,
  clubId: Id<"clubs">,
  userId: Id<"users">,
) {
  const [units, memberships] = await Promise.all([
    ctx.db
      .query("clubUnits")
      .withIndex("by_clubId_and_isActive_and_position", (q) =>
        q.eq("clubId", clubId).eq("isActive", true),
      )
      .take(MAX_CLUB_UNITS),
    ctx.db
      .query("clubUnitMembers")
      .withIndex("by_userId_and_clubId", (q) => q.eq("userId", userId).eq("clubId", clubId))
      .take(MAX_CLUB_UNITS),
  ]);
  return {
    memberships,
    parentByUnitId: new Map(units.map((unit) => [unit._id, unit.parentUnitId ?? null])),
  };
}

async function isExplicitMember(
  ctx: ChannelDbCtx,
  channelId: Id<"clubChannels">,
  userId: Id<"users">,
) {
  return !!(await ctx.db
    .query("clubChannelMemberships")
    .withIndex("by_channelId_and_userId", (q) => q.eq("channelId", channelId).eq("userId", userId))
    .unique());
}

/**
 * The single authorization boundary for unit-aware channels. Callers must use
 * this result for reads and writes; navigation filtering is not authorization.
 */
export async function getChannelAccess(
  ctx: ChannelDbCtx,
  channel: Channel,
  context: ClubContext,
  userId: Id<"users">,
): Promise<ChannelAccess> {
  const policy = effectiveChannelPolicy(channel);
  const canManage = context.canManageChannels;
  if (!context.canAccessWorkspace) return { canView: false, canPost: false, canManage };
  if (context.isAdmin || context.isSponsor || context.canSeePrivateChannels) {
    return { canView: true, canPost: policy.postingPolicy !== "CLUB_MANAGERS" || context.permissions.postToReadOnlyChannels || canManage, canManage };
  }

  let audienceMember = false;
  let unitLeader = false;
  if (policy.audienceKind === "CLUB") {
    audienceMember = true;
  } else if (policy.audienceKind === "CUSTOM") {
    audienceMember = await isExplicitMember(ctx, channel._id, userId);
  } else if (policy.audienceUnitId) {
    const { memberships, parentByUnitId } = await unitAccessInputs(ctx, channel.clubId, userId);
    const relatedMemberships = memberships.filter((membership) =>
      policy.includeDescendants
        ? isUnitOrDescendant(membership.unitId, policy.audienceUnitId!, parentByUnitId)
        : membership.unitId === policy.audienceUnitId,
    );
    audienceMember = policy.audienceKind === "UNIT_MEMBERS"
      ? relatedMemberships.length > 0
      : relatedMemberships.some((membership) => membership.role === "LEADER");
    unitLeader = relatedMemberships.some((membership) => membership.role === "LEADER");
    if (!unitLeader && policy.includeAncestorLeaders) {
      unitLeader = memberships.some((membership) =>
        membership.role === "LEADER" && isTargetOrAncestor(
          membership.unitId,
          policy.audienceUnitId!,
          parentByUnitId,
        ),
      );
    }
    if (policy.audienceKind === "UNIT_MEMBERS" && unitLeader && policy.includeAncestorLeaders) {
      audienceMember = true;
    }
  }

  const canView = audienceMember || unitLeader;
  const canPost = canView && (
    policy.postingPolicy === "AUDIENCE" ||
    (policy.postingPolicy === "UNIT_LEADERS" && unitLeader) ||
    (policy.postingPolicy === "CLUB_MANAGERS" && (context.permissions.postToReadOnlyChannels || canManage))
  );
  return { canView, canPost, canManage };
}

/** Resolves a bounded audience for notification and mention delivery. */
export async function getChannelAudienceUserIds(
  ctx: MutationCtx,
  channel: Channel,
  limit: number,
) {
  const policy = effectiveChannelPolicy(channel);
  if (policy.audienceKind === "CUSTOM") {
    return (await ctx.db.query("clubChannelMemberships")
      .withIndex("by_channelId", (q) => q.eq("channelId", channel._id))
      .take(limit)).map((row) => row.userId);
  }
  if (policy.audienceKind === "CLUB") {
    const [members, sponsors] = await Promise.all([
      ctx.db.query("clubMembers")
      .withIndex("by_clubId", (q) => q.eq("clubId", channel.clubId))
      .take(limit),
      ctx.db.query("clubSponsors")
        .withIndex("by_clubId", (q) => q.eq("clubId", channel.clubId))
        .take(limit),
    ]);
    return [...new Set([...members, ...sponsors].map((row) => row.userId))].slice(0, limit);
  }
  if (!policy.audienceUnitId) return [];
  const [units, memberships] = await Promise.all([
    ctx.db.query("clubUnits")
      .withIndex("by_clubId_and_isActive_and_position", (q) => q.eq("clubId", channel.clubId).eq("isActive", true))
      .take(MAX_CLUB_UNITS),
    ctx.db.query("clubUnitMembers")
      .withIndex("by_clubId_and_unitId", (q) => q.eq("clubId", channel.clubId))
      .take(MAX_CLUB_UNITS * 4),
  ]);
  const parentByUnitId = new Map(units.map((unit) => [unit._id, unit.parentUnitId ?? null]));
  return memberships
    .filter((membership) => {
      const related = policy.includeDescendants
        ? isUnitOrDescendant(membership.unitId, policy.audienceUnitId!, parentByUnitId)
        : membership.unitId === policy.audienceUnitId;
      return related && (policy.audienceKind === "UNIT_MEMBERS" || membership.role === "LEADER");
    })
    .slice(0, limit)
    .map((membership) => membership.userId);
}
