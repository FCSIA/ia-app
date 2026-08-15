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
  accessRoleIds: Id<"clubRoles">[];
  accessUnitId: Id<"clubUnits"> | null;
  explicitOnly: boolean;
  postingPolicy: "AUDIENCE" | "CLUB_MANAGERS";
};

/**
 * Current channels use independent role and structure filters. Legacy rows
 * retain their closest safe meaning until they are saved through settings.
 */
export function effectiveChannelPolicy(channel: Channel): EffectivePolicy {
  if (channel.accessPolicyVersion === 2) {
    return {
      accessRoleIds: channel.accessRoleIds ?? [],
      accessUnitId: channel.accessUnitId ?? null,
      explicitOnly: false,
      postingPolicy:
        channel.postingPolicy === "CLUB_MANAGERS"
          ? "CLUB_MANAGERS"
          : "AUDIENCE",
    };
  }

  if (
    channel.audienceKind === "CUSTOM" ||
    (!channel.audienceKind && channel.visibility === "PRIVATE")
  ) {
    return {
      accessRoleIds: [],
      accessUnitId: null,
      explicitOnly: true,
      postingPolicy:
        channel.postingPolicy === "CLUB_MANAGERS" ||
        channel.postingPolicy === "UNIT_LEADERS"
          ? "CLUB_MANAGERS"
          : "AUDIENCE",
    };
  }

  return {
    accessRoleIds: [],
    accessUnitId:
      channel.audienceKind === "UNIT_MEMBERS" ||
      channel.audienceKind === "UNIT_LEADERS"
        ? channel.audienceUnitId ?? null
        : null,
    explicitOnly: false,
    postingPolicy:
      channel.postingPolicy === "CLUB_MANAGERS" ||
      channel.postingPolicy === "UNIT_LEADERS" ||
      channel.visibility === "MEMBER_READONLY"
        ? "CLUB_MANAGERS"
        : "AUDIENCE",
  };
}

/** An assignment at the target or any ancestor grants downward access. */
function assignmentCoversUnit(
  assignedUnitId: Id<"clubUnits">,
  targetUnitId: Id<"clubUnits">,
  parentByUnitId: Map<Id<"clubUnits">, Id<"clubUnits"> | null>,
) {
  let current: Id<"clubUnits"> | null = targetUnitId;
  const visited = new Set<Id<"clubUnits">>();
  while (current) {
    if (current === assignedUnitId) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    current = parentByUnitId.get(current) ?? null;
  }
  return false;
}

async function isExplicitMember(
  ctx: ChannelDbCtx,
  channelId: Id<"clubChannels">,
  userId: Id<"users">,
) {
  return !!(await ctx.db
    .query("clubChannelMemberships")
    .withIndex("by_channelId_and_userId", (q) =>
      q.eq("channelId", channelId).eq("userId", userId),
    )
    .unique());
}

async function matchesChannelFilters(
  ctx: ChannelDbCtx,
  channel: Channel,
  policy: EffectivePolicy,
  userId: Id<"users">,
) {
  const clubMembership = await ctx.db
    .query("clubMembers")
    .withIndex("by_clubId_and_userId", (q) =>
      q.eq("clubId", channel.clubId).eq("userId", userId),
    )
    .unique();
  if (!clubMembership) return false;

  const roleId = clubMembership.roleId ?? clubMembership.customRoleId;
  const roleMatches =
    policy.accessRoleIds.length === 0 ||
    (!!roleId && policy.accessRoleIds.includes(roleId));
  if (!roleMatches) return false;
  if (!policy.accessUnitId) return true;

  const [units, memberships] = await Promise.all([
    ctx.db
      .query("clubUnits")
      .withIndex("by_clubId_and_isActive_and_position", (q) =>
        q.eq("clubId", channel.clubId).eq("isActive", true),
      )
      .take(MAX_CLUB_UNITS),
    ctx.db
      .query("clubUnitMembers")
      .withIndex("by_userId_and_clubId", (q) =>
        q.eq("userId", userId).eq("clubId", channel.clubId),
      )
      .take(MAX_CLUB_UNITS),
  ]);
  const parentByUnitId = new Map(
    units.map((unit) => [unit._id, unit.parentUnitId ?? null]),
  );
  return memberships.some((membership) =>
    assignmentCoversUnit(
      membership.unitId,
      policy.accessUnitId!,
      parentByUnitId,
    ),
  );
}

/**
 * Single authorization boundary for channel reads and writes. Navigation
 * filtering is never treated as authorization.
 */
export async function getChannelAccess(
  ctx: ChannelDbCtx,
  channel: Channel,
  context: ClubContext,
  userId: Id<"users">,
): Promise<ChannelAccess> {
  const policy = effectiveChannelPolicy(channel);
  const canManage = context.canManageChannels;
  if (!context.canAccessWorkspace) {
    return { canView: false, canPost: false, canManage };
  }

  if (
    context.isAdmin ||
    context.isSponsor ||
    context.canSeePrivateChannels ||
    canManage
  ) {
    return {
      canView: true,
      canPost:
        policy.postingPolicy === "AUDIENCE" ||
        context.permissions.postToReadOnlyChannels ||
        canManage,
      canManage,
    };
  }

  const explicit = await isExplicitMember(ctx, channel._id, userId);
  const audienceMember =
    explicit ||
    (!policy.explicitOnly &&
      (await matchesChannelFilters(ctx, channel, policy, userId)));
  return {
    canView: audienceMember,
    canPost: audienceMember && policy.postingPolicy === "AUDIENCE",
    canManage,
  };
}

/** Resolves a bounded audience for notification and mention delivery. */
export async function getChannelAudienceUserIds(
  ctx: MutationCtx,
  channel: Channel,
  limit: number,
) {
  const policy = effectiveChannelPolicy(channel);
  const explicitRows = await ctx.db
    .query("clubChannelMemberships")
    .withIndex("by_channelId", (q) => q.eq("channelId", channel._id))
    .take(limit);
  const audienceIds = new Set(explicitRows.map((row) => row.userId));
  if (policy.explicitOnly || audienceIds.size >= limit) {
    return [...audienceIds].slice(0, limit);
  }

  const [clubMembers, units, unitMemberships] = await Promise.all([
    ctx.db
      .query("clubMembers")
      .withIndex("by_clubId", (q) => q.eq("clubId", channel.clubId))
      .take(limit * 4),
    policy.accessUnitId
      ? ctx.db
          .query("clubUnits")
          .withIndex("by_clubId_and_isActive_and_position", (q) =>
            q.eq("clubId", channel.clubId).eq("isActive", true),
          )
          .take(MAX_CLUB_UNITS)
      : Promise.resolve([]),
    policy.accessUnitId
      ? ctx.db
          .query("clubUnitMembers")
          .withIndex("by_clubId_and_unitId", (q) =>
            q.eq("clubId", channel.clubId),
          )
          .take(MAX_CLUB_UNITS * 4)
      : Promise.resolve([]),
  ]);
  const parentByUnitId = new Map(
    units.map((unit) => [unit._id, unit.parentUnitId ?? null]),
  );
  const membershipsByUserId = new Map<Id<"users">, Id<"clubUnits">[]>();
  for (const membership of unitMemberships) {
    const current = membershipsByUserId.get(membership.userId) ?? [];
    current.push(membership.unitId);
    membershipsByUserId.set(membership.userId, current);
  }

  for (const member of clubMembers) {
    const roleId = member.roleId ?? member.customRoleId;
    const roleMatches =
      policy.accessRoleIds.length === 0 ||
      (!!roleId && policy.accessRoleIds.includes(roleId));
    const unitMatches =
      !policy.accessUnitId ||
      (membershipsByUserId.get(member.userId) ?? []).some((unitId) =>
        assignmentCoversUnit(
          unitId,
          policy.accessUnitId!,
          parentByUnitId,
        ),
      );
    if (roleMatches && unitMatches) audienceIds.add(member.userId);
    if (audienceIds.size >= limit) break;
  }

  return [...audienceIds].slice(0, limit);
}
