import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import { getChannelViewerContext, getViewerContext } from "./access";
import { getChannelAccessForChannels } from "./channelAccess";
import { NO_CLUB_PERMISSIONS } from "./rolePermissions";
import { clubRolePermissionsValidator } from "../validators";
import {
  clubSummaryValidator,
  clubUserRefValidator,
  clubViewerStateValidator,
  clubSummaryWithCounts,
  getVisibleChannels,
  toClubUserRef,
  toViewerState,
  visibleClubChannelValidator,
  workspaceClubChannelValidator,
} from "./serialize";
import {
  clubJoinRequestStatusValidator,
  clubMemberRoleValidator,
} from "../validators";

const clubMemberWithUserValidator = v.object({
  userId: v.id("users"),
  role: v.union(clubMemberRoleValidator, v.null()),
  customRoleId: v.union(v.id("clubRoles"), v.null()),
  roleId: v.union(v.id("clubRoles"), v.null()),
  user: clubUserRefValidator,
});
const clubSponsorWithUserValidator = v.object({
  userId: v.id("users"),
  user: clubUserRefValidator,
});
const clubDetailValidator = v.union(
  v.object({
    ...clubSummaryValidator.fields,
    members: v.array(clubMemberWithUserValidator),
    leaders: v.array(clubMemberWithUserValidator),
    sponsors: v.array(clubSponsorWithUserValidator),
    roles: v.array(v.object({
      _id: v.id("clubRoles"),
      name: v.string(),
      permissions: clubRolePermissionsValidator,
      isDefault: v.boolean(),
      showInDirectory: v.boolean(),
      position: v.number(),
    })),
    channels: v.array(visibleClubChannelValidator),
    tags: v.array(
      v.object({
        _id: v.id("clubTags"),
        clubId: v.id("clubs"),
        name: v.string(),
        slug: v.string(),
        createdById: v.id("users"),
        createdAt: v.number(),
        members: v.array(v.object({ user: clubUserRefValidator })),
      }),
    ),
    directory: v.array(
      v.object({
        ...clubUserRefValidator.fields,
        kind: v.union(v.literal("SPONSOR"), v.literal("MEMBER")),
        clubRole: v.union(clubMemberRoleValidator, v.null()),
        customRoleId: v.union(v.id("clubRoles"), v.null()),
        customRoleName: v.union(v.string(), v.null()),
        roleId: v.union(v.id("clubRoles"), v.null()),
        roleName: v.union(v.string(), v.null()),
        unitNames: v.array(v.string()),
        joinedAt: v.string(),
      }),
    ),
    viewer: clubViewerStateValidator,
    pendingJoinRequests: v.array(
      v.object({
        _id: v.id("clubJoinRequests"),
        clubId: v.id("clubs"),
        requesterId: v.id("users"),
        status: clubJoinRequestStatusValidator,
        createdAt: v.string(),
        requester: clubUserRefValidator,
      }),
    ),
    activeJoinCode: v.union(
      v.object({
        code: v.string(),
        updatedAt: v.union(v.string(), v.null()),
        expiresAt: v.string(),
      }),
      v.null(),
    ),
  }),
  v.null(),
);

const workspaceNavigationValidator = v.union(
  v.object({
    club: v.object({
      _id: v.id("clubs"),
      name: v.string(),
      logoUrl: v.union(v.string(), v.null()),
    }),
    viewer: v.object({
      canCreateChannels: v.boolean(),
      canEditChannels: v.boolean(),
      canDeleteChannels: v.boolean(),
      canManageChannels: v.boolean(),
      canManageRoles: v.boolean(),
      canManageClubStructure: v.boolean(),
    }),
    channels: v.array(workspaceClubChannelValidator),
    units: v.array(v.object({
      _id: v.id("clubUnits"),
      parentUnitId: v.union(v.id("clubUnits"), v.null()),
      name: v.string(),
      kind: v.union(v.string(), v.null()),
      position: v.number(),
    })),
    myClubs: v.array(
      v.object({
        _id: v.id("clubs"),
        name: v.string(),
        logoUrl: v.union(v.string(), v.null()),
        role: v.union(clubMemberRoleValidator, v.null()),
      }),
    ),
  }),
  v.null(),
);

export const get = query({
  args: { clubId: v.id("clubs") },
  returns: clubDetailValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const club = await ctx.db.get(args.clubId);
    if (!club || !club.isActive) return null;

    const context = await getViewerContext(ctx, args.clubId, user);

    const [
      memberships,
      sponsorsRows,
      tags,
      pendingRequests,
      customRoles,
      units,
      unitMemberships,
    ] = await Promise.all([
      ctx.db
        .query("clubMembers")
        .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
        .collect(),
      ctx.db
        .query("clubSponsors")
        .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
        .collect(),
      context.canAccessWorkspace
        ? ctx.db
            .query("clubTags")
            .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
            .collect()
        : Promise.resolve([]),
      context.canApproveJoinRequests
        ? ctx.db
            .query("clubJoinRequests")
            .withIndex("by_clubId_and_status", (q) =>
              q.eq("clubId", args.clubId).eq("status", "PENDING"),
            )
            .collect()
        : Promise.resolve([]),
      ctx.db
        .query("clubRoles")
        .withIndex("by_clubId_and_position", (q) => q.eq("clubId", args.clubId))
        .take(100),
      ctx.db
        .query("clubUnits")
        .withIndex("by_clubId_and_isActive_and_position", (q) =>
          q.eq("clubId", args.clubId).eq("isActive", true),
        )
        .take(250),
      ctx.db
        .query("clubUnitMembers")
        .withIndex("by_clubId_and_unitId", (q) => q.eq("clubId", args.clubId))
        .collect(),
    ]);

    // Deduplicate memberships by userId to prevent duplicate entries
    const uniqueMemberships = Array.from(
      new Map(memberships.map((m) => [m.userId, m])).values(),
    );
    // Deduplicate sponsors by userId to prevent duplicate entries
    const uniqueSponsors = Array.from(
      new Map(sponsorsRows.map((s) => [s.userId, s])).values(),
    );

    const members = await Promise.all(
      uniqueMemberships.map(async (m) => {
        const memberUser = await ctx.db.get(m.userId);
        if (!memberUser) return null;
        return {
          userId: m.userId,
          role: m.role ?? null,
          customRoleId: m.customRoleId ?? null,
          roleId: m.roleId ?? null,
          user: toClubUserRef(memberUser),
        };
      }),
    );

    const sponsors = await Promise.all(
      uniqueSponsors.map(async (s) => {
        const sponsorUser = await ctx.db.get(s.userId);
        if (!sponsorUser) return null;
        return { userId: s.userId, user: toClubUserRef(sponsorUser) };
      }),
    );

    const hydratedMembers = members.filter((m): m is NonNullable<typeof m> => !!m);
    const hydratedSponsors = sponsors.filter((s): s is NonNullable<typeof s> => !!s);
    const customRoleNames = new Map(customRoles.map((role) => [role._id, role.name]));
    const unitNameById = new Map(units.map((unit) => [unit._id, unit.name]));
    const unitNamesByUserId = new Map<Id<"users">, string[]>();
    for (const membership of unitMemberships) {
      const unitName = unitNameById.get(membership.unitId);
      if (!unitName) continue;
      const names = unitNamesByUserId.get(membership.userId) ?? [];
      names.push(unitName);
      unitNamesByUserId.set(membership.userId, names);
    }
    const defaultRole = customRoles.find((role) => role.isDefault);
    const legacyLeaderRole = customRoles.find((role) => role.position === 1);
    const roleForMember = (member: (typeof hydratedMembers)[number]) => {
      const id = member.roleId ?? member.customRoleId ??
        (member.role === "LEADER" || member.role === "SPONSOR" ? legacyLeaderRole?._id : defaultRole?._id);
      return id ? customRoles.find((role) => role._id === id) ?? null : null;
    };
    const leaders = hydratedMembers.filter((member) => {
      const role = roleForMember(member);
      return role ? Object.values(role.permissions ?? NO_CLUB_PERMISSIONS).some(Boolean) : member.role === "LEADER";
    });
    const sponsorUserIds = new Set(uniqueSponsors.map((s) => s.userId));

    const serializedTags = await Promise.all(
      tags.map(async (tag) => {
        const tagMembers = await ctx.db
          .query("clubTagMembers")
          .withIndex("by_tagId", (q) => q.eq("tagId", tag._id))
          .collect();
        const membersWithUsers = await Promise.all(
          tagMembers.map(async (tm) => {
            const u = await ctx.db.get(tm.userId);
            return u ? { user: toClubUserRef(u) } : null;
          }),
        );
        return {
          _id: tag._id,
          clubId: tag.clubId,
          name: tag.name,
          slug: tag.slug,
          createdById: tag.createdById,
          createdAt: tag.createdAt,
          members: membersWithUsers.filter((m): m is NonNullable<typeof m> => !!m),
        };
      }),
    );

    const pendingJoinRequests = await Promise.all(
      pendingRequests.map(async (request) => {
        const requester = await ctx.db.get(request.requesterId);
        if (!requester) return null;
        return {
          _id: request._id,
          clubId: request.clubId,
          requesterId: request.requesterId,
          status: request.status,
          createdAt: new Date(request.createdAt).toISOString(),
          requester: toClubUserRef(requester),
        };
      }),
    );

    const directory = [
      ...hydratedSponsors.map((s) => ({
        ...s.user,
        kind: "SPONSOR" as const,
        clubRole: "SPONSOR" as const,
        customRoleId: null,
        customRoleName: null,
        roleId: null,
        roleName: "Sponsor",
        unitNames: unitNamesByUserId.get(s.userId) ?? [],
        joinedAt: new Date(0).toISOString(),
      })),
      ...hydratedMembers
        .filter((m) => !sponsorUserIds.has(m.userId))
        .map((m) => {
          const role = roleForMember(m);
          return {
            ...m.user,
            kind: "MEMBER" as const,
            clubRole: m.role === "LEADER" ? "LEADER" as const : null,
            customRoleId: m.customRoleId ?? null,
            customRoleName: m.customRoleId ? customRoleNames.get(m.customRoleId) ?? null : null,
            roleId: role?._id ?? null,
            roleName: role?.name ?? (m.role === "LEADER" ? "Leader" : "Member"),
            unitNames: unitNamesByUserId.get(m.userId) ?? [],
            joinedAt: new Date(
              uniqueMemberships.find((row) => row.userId === m.userId)?.joinedAt ?? 0,
            ).toISOString(),
          };
        }),
    ];

    const visibleChannels = context.canAccessWorkspace
      ? await getVisibleChannels(ctx, args.clubId, context, user._id, {
          units,
          unitMemberships: unitMemberships.filter(
            (membership) => membership.userId === user._id,
          ),
        })
      : null;
    const summary = await clubSummaryWithCounts(
      ctx,
      club,
      context.membership?.role ?? null,
      {
        members: memberships.length,
        ...(visibleChannels ? { channels: visibleChannels.totalCount } : {}),
      },
    );

    return {
      ...summary,
      members: context.canAccessWorkspace ? hydratedMembers : [],
      leaders,
      sponsors: hydratedSponsors,
      roles: customRoles
        .filter((role) => role.position !== undefined)
        .map((role) => ({
          _id: role._id,
          name: role.name,
          permissions: role.permissions ?? NO_CLUB_PERMISSIONS,
          isDefault: role.isDefault ?? false,
          showInDirectory: role.showInDirectory ?? false,
          position: role.position ?? 0,
        })),
      channels: visibleChannels?.channels ?? [],
      tags: context.canAccessWorkspace ? serializedTags : [],
      directory: context.canAccessWorkspace ? directory : [],
      viewer: toViewerState(context),
      pendingJoinRequests: pendingJoinRequests.filter(
        (r): r is NonNullable<typeof r> => !!r,
      ),
      activeJoinCode:
        context.permissions.manageJoinCodes && club.joinCode && club.joinCodeExpiresAt && club.joinCodeExpiresAt > Date.now()
          ? {
              code: club.joinCode,
              updatedAt: club.joinCodeUpdatedAt
                ? new Date(club.joinCodeUpdatedAt).toISOString()
                : null,
              expiresAt: new Date(club.joinCodeExpiresAt).toISOString(),
            }
          : null,
    };
  },
});

/** Small, stable payload for the club shell on every workspace route. */
export const getWorkspaceNavigation = query({
  args: { clubId: v.id("clubs") },
  returns: workspaceNavigationValidator,
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return null;
    const club = await ctx.db.get(args.clubId);
    if (!club || !club.isActive) return null;
    const context = await getChannelViewerContext(ctx, club, user);
    if (!context.canAccessWorkspace) return null;

    const channelRows = await ctx.db
      .query("clubChannels")
      .withIndex("by_clubId_and_visibility", (q) => q.eq("clubId", club._id))
      .collect();
    const [readReceipts, unitRows] = await Promise.all([
      ctx.db
        .query("clubChannelReadReceipts")
        .withIndex("by_userId_and_clubId", (q) =>
          q.eq("userId", user._id).eq("clubId", club._id),
        )
        .take(500),
      ctx.db
        .query("clubUnits")
        .withIndex("by_clubId_and_isActive_and_position", (q) =>
          q.eq("clubId", club._id).eq("isActive", true),
        )
        .take(250),
    ]);
    const lastReadAtByChannelId = new Map(
      readReceipts.map((receipt) => [receipt.channelId, receipt.lastReadAt]),
    );
    const accessByChannelId = await getChannelAccessForChannels(
      ctx,
      channelRows,
      context,
      user._id,
      { units: unitRows },
    );
    const channels = (
      await Promise.all(
        channelRows.map(async (channel) => {
          let memberships: Doc<"clubChannelMemberships">[] = [];
          if (channel.visibility === "PRIVATE") {
            if (context.canSeePrivateChannels) {
              memberships = await ctx.db
                .query("clubChannelMemberships")
                .withIndex("by_channelId", (q) => q.eq("channelId", channel._id))
                .collect();
            } else {
              const viewerMembership = await ctx.db
                .query("clubChannelMemberships")
                .withIndex("by_channelId_and_userId", (q) =>
                  q.eq("channelId", channel._id).eq("userId", user._id),
                )
                .unique();
              memberships = viewerMembership ? [viewerMembership] : [];
            }
          }
          const access = accessByChannelId.get(channel._id)!;
          if (!access.canView) return null;
          return {
            _id: channel._id,
            clubId: channel.clubId,
            ownerUnitId: channel.ownerUnitId,
            position: channel.position,
            accessPolicyVersion: channel.accessPolicyVersion,
            accessRoleIds: channel.accessRoleIds,
            accessUnitId: channel.accessUnitId,
            audienceKind: channel.audienceKind,
            audienceUnitId: channel.audienceUnitId,
            includeDescendants: channel.includeDescendants,
            includeAncestorLeaders: channel.includeAncestorLeaders,
            postingPolicy: channel.postingPolicy,
            name: channel.name,
            description: channel.description,
            visibility: channel.visibility,
            createdById: channel.createdById,
            lastMessageAt: channel.lastMessageAt,
            createdAt: channel.createdAt,
            updatedAt: channel.updatedAt,
            memberships: memberships.map((membership) => ({ userId: membership.userId })),
            viewerCanPost: access.canPost,
            hasUnreadMessages:
              (channel.lastMessageAt ?? 0) >
              (lastReadAtByChannelId.get(channel._id) ?? 0),
          };
        }),
      )
    )
      .filter((channel): channel is NonNullable<typeof channel> => !!channel)
      .sort(
        (a, b) =>
          (a.position ?? Number.MAX_SAFE_INTEGER) -
            (b.position ?? Number.MAX_SAFE_INTEGER) ||
          a.createdAt - b.createdAt,
      );

    const [memberRows, sponsorRows] = await Promise.all([
      ctx.db
        .query("clubMembers")
        .withIndex("by_userId_and_joinedAt", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("clubSponsors")
        .withIndex("by_userId_and_clubId", (q) => q.eq("userId", user._id))
        .collect(),
    ]);
    const clubRoles = new Map([
      ...memberRows.map((membership) => [membership.clubId, membership.role ?? null] as const),
      ...sponsorRows.map((sponsorship) => [sponsorship.clubId, "SPONSOR" as const] as const),
    ]);
    const myClubs = user.roles.includes("SUPER_ADMIN")
      ? (
          await ctx.db
            .query("clubs")
            .withIndex("by_isActive_and_name", (q) => q.eq("isActive", true))
            .collect()
        ).map((row) => ({
          _id: row._id,
          name: row.name,
          logoUrl: row.logoUrl ?? null,
          role: null,
        }))
      : (
          await Promise.all(
            Array.from(clubRoles, async ([clubId, role]) => {
              const row = await ctx.db.get(clubId);
              if (!row?.isActive) return null;
              return { _id: row._id, name: row.name, logoUrl: row.logoUrl ?? null, role };
            }),
          )
        ).filter((row): row is NonNullable<typeof row> => !!row);

    return {
      club: { _id: club._id, name: club.name, logoUrl: club.logoUrl ?? null },
      viewer: {
        canCreateChannels: context.permissions.createChannels,
        canEditChannels: context.permissions.editChannels,
        canDeleteChannels: context.permissions.deleteChannels,
        canManageChannels: context.canManageChannels,
        canManageRoles: context.permissions.manageRoles,
        canManageClubStructure: context.permissions.manageClubStructure,
      },
      channels,
      units: unitRows.map((unit) => ({
        _id: unit._id,
        parentUnitId: unit.parentUnitId ?? null,
        name: unit.name,
        kind: unit.kind ?? null,
        position: unit.position,
      })),
      myClubs,
    };
  },
});
