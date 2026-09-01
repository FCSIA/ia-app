import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { ClubContext } from "./access";
import { NO_CLUB_PERMISSIONS } from "./rolePermissions";
import { MAX_CLUB_UNITS } from "./hierarchyRules";

type ChannelDbCtx = QueryCtx | MutationCtx;
type Channel = Doc<"clubChannels">;

export type ChannelAccess = {
  canView: boolean;
  canPost: boolean;
  canManage: boolean;
};

export type ChannelAccessBatchState = {
  units?: Doc<"clubUnits">[];
  unitMemberships?: Doc<"clubUnitMembers">[];
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

function elevatedChannelAccess(
  context: ClubContext,
  policy: EffectivePolicy,
): ChannelAccess {
  const canManage = context.canManageChannels;
  return {
    canView: true,
    canPost:
      policy.postingPolicy === "AUDIENCE" ||
      context.permissions.postToReadOnlyChannels ||
      canManage,
    canManage,
  };
}

function deniedChannelAccess(context: ClubContext): ChannelAccess {
  return {
    canView: false,
    canPost: false,
    canManage: context.canManageChannels,
  };
}

function isUnrestrictedPolicy(policy: EffectivePolicy) {
  return (
    !policy.explicitOnly &&
    policy.accessRoleIds.length === 0 &&
    policy.accessUnitId === null
  );
}

/**
 * Resolve one viewer against a set of sibling channels while loading the
 * viewer's role and unit state only once. Club shells commonly render dozens
 * of channels, so repeating the unit-tree reads for every channel multiplies a
 * small club into hundreds of documents per subscription execution.
 */
export async function getChannelAccessForChannels(
  ctx: ChannelDbCtx,
  channels: Channel[],
  context: ClubContext,
  userId: Id<"users">,
  preloaded: ChannelAccessBatchState = {},
) {
  const accessByChannelId = new Map<Id<"clubChannels">, ChannelAccess>();
  if (channels.length === 0) return accessByChannelId;

  const scopedChannels = channels.filter((channel) => {
    if (channel.clubId === context.club._id) return true;
    accessByChannelId.set(channel._id, deniedChannelAccess(context));
    return false;
  });
  if (scopedChannels.length === 0) return accessByChannelId;

  if (!context.canAccessWorkspace) {
    for (const channel of scopedChannels) {
      accessByChannelId.set(channel._id, deniedChannelAccess(context));
    }
    return accessByChannelId;
  }

  const policies = new Map(
    scopedChannels.map((channel) => [
      channel._id,
      effectiveChannelPolicy(channel),
    ]),
  );
  if (
    context.isAdmin ||
    context.isSponsor ||
    context.canSeePrivateChannels ||
    context.canManageChannels
  ) {
    for (const channel of scopedChannels) {
      accessByChannelId.set(
        channel._id,
        elevatedChannelAccess(context, policies.get(channel._id)!),
      );
    }
    return accessByChannelId;
  }

  const restrictedChannels = scopedChannels.filter(
    (channel) => !isUnrestrictedPolicy(policies.get(channel._id)!),
  );
  const explicitMembershipEntries = await Promise.all(
    restrictedChannels.map(async (channel) => {
      const membership = await ctx.db
        .query("clubChannelMemberships")
        .withIndex("by_channelId_and_userId", (q) =>
          q.eq("channelId", channel._id).eq("userId", userId),
        )
        .unique();
      return [channel._id, !!membership] as const;
    }),
  );
  const explicitMembershipByChannelId = new Map(explicitMembershipEntries);

  const filteredChannels = restrictedChannels.filter(
    (channel) => !policies.get(channel._id)!.explicitOnly,
  );
  const clubId = context.club._id;
  const clubMembership =
    context.membership ??
    (filteredChannels.length > 0
      ? await ctx.db
          .query("clubMembers")
          .withIndex("by_clubId_and_userId", (q) =>
            q.eq("clubId", clubId).eq("userId", userId),
          )
          .unique()
      : null);
  const needsUnitState = filteredChannels.some(
    (channel) => policies.get(channel._id)!.accessUnitId !== null,
  );
  const [units, unitMemberships] = needsUnitState
    ? await Promise.all([
        preloaded.units ??
          ctx.db
            .query("clubUnits")
            .withIndex("by_clubId_and_isActive_and_position", (q) =>
              q.eq("clubId", clubId).eq("isActive", true),
            )
            .take(MAX_CLUB_UNITS),
        preloaded.unitMemberships ??
          ctx.db
            .query("clubUnitMembers")
            .withIndex("by_userId_and_clubId", (q) =>
              q.eq("userId", userId).eq("clubId", clubId),
            )
            .take(MAX_CLUB_UNITS),
      ])
    : [[], []];
  const parentByUnitId = new Map<
    Id<"clubUnits">,
    Id<"clubUnits"> | null
  >(units.map((unit) => [unit._id, unit.parentUnitId ?? null]));

  for (const channel of scopedChannels) {
    const policy = policies.get(channel._id)!;
    if (isUnrestrictedPolicy(policy)) {
      accessByChannelId.set(channel._id, {
        canView: true,
        canPost: policy.postingPolicy === "AUDIENCE",
        canManage: false,
      });
      continue;
    }

    const explicit = explicitMembershipByChannelId.get(channel._id) ?? false;
    const roleId = clubMembership?.roleId ?? clubMembership?.customRoleId;
    const roleMatches =
      policy.accessRoleIds.length === 0 ||
      (!!roleId && policy.accessRoleIds.includes(roleId));
    const unitMatches =
      policy.accessUnitId === null ||
      unitMemberships.some((membership) =>
        assignmentCoversUnit(
          membership.unitId,
          policy.accessUnitId!,
          parentByUnitId,
        ),
      );
    const audienceMember =
      explicit ||
      (!policy.explicitOnly && !!clubMembership && roleMatches && unitMatches);
    accessByChannelId.set(channel._id, {
      canView: audienceMember,
      canPost: audienceMember && policy.postingPolicy === "AUDIENCE",
      canManage: false,
    });
  }

  return accessByChannelId;
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
  const accessByChannelId = await getChannelAccessForChannels(
    ctx,
    [channel],
    context,
    userId,
  );
  return accessByChannelId.get(channel._id)!;
}

/** Resolves a bounded audience for notification and mention delivery. */
export async function getChannelAudienceUserIds(
  ctx: ChannelDbCtx,
  channel: Channel,
  limit: number,
) {
  const policy = effectiveChannelPolicy(channel);
  const [
    explicitRows,
    sponsors,
    clubMembers,
    roles,
    units,
    unitMemberships,
  ] = await Promise.all([
    ctx.db
      .query("clubChannelMemberships")
      .withIndex("by_channelId", (q) => q.eq("channelId", channel._id))
      .take(limit),
    ctx.db
      .query("clubSponsors")
      .withIndex("by_clubId", (q) => q.eq("clubId", channel.clubId))
      .take(limit),
    ctx.db
      .query("clubMembers")
      .withIndex("by_clubId", (q) => q.eq("clubId", channel.clubId))
      .take(limit * 4),
    ctx.db
      .query("clubRoles")
      .withIndex("by_clubId_and_position", (q) => q.eq("clubId", channel.clubId))
      .take(100),
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
  const roleById = new Map(roles.map((role) => [role._id, role]));
  const parentByUnitId = new Map(
    units.map((unit) => [unit._id, unit.parentUnitId ?? null]),
  );
  const membershipsByUserId = new Map<Id<"users">, Id<"clubUnits">[]>();
  for (const membership of unitMemberships) {
    const current = membershipsByUserId.get(membership.userId) ?? [];
    current.push(membership.unitId);
    membershipsByUserId.set(membership.userId, current);
  }
  const audienceIds = new Set<Id<"users">>();
  const addAudience = (userId: Id<"users">) => {
    if (audienceIds.size < limit) audienceIds.add(userId);
  };

  // Sponsors and club roles that can see or manage every channel receive the
  // same audience treatment as the per-viewer access boundary. Put them first
  // so a large house does not hide its school-level leaders from @ suggestions.
  for (const sponsor of sponsors) addAudience(sponsor.userId);
  for (const member of clubMembers) {
    const roleId = member.roleId ?? member.customRoleId;
    const role = roleId ? roleById.get(roleId) : undefined;
    const permissions = role?.permissions ?? NO_CLUB_PERMISSIONS;
    const hasElevatedChannelAccess =
      member.role === "LEADER" ||
      member.role === "SPONSOR" ||
      permissions.viewPrivateChannels ||
      permissions.createChannels ||
      permissions.editChannels ||
      permissions.deleteChannels;
    if (hasElevatedChannelAccess) addAudience(member.userId);
  }
  for (const explicit of explicitRows) addAudience(explicit.userId);

  if (policy.explicitOnly || audienceIds.size >= limit) {
    return [...audienceIds];
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
