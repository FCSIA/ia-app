import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../../lib/currentUser";
import { logAuditEvent } from "../audit/_lib";
import {
  getFriendshipBetween,
  isStudentUser,
  requireStudentUser,
  serializeScheduleForUser,
  serializeUser,
  studentScheduleRecordValidator,
  studentVisibility,
} from "./_lib";
import { clusterSharedClasses } from "./groupComparison";
import { canAddAcceptedFriendToGroup, isScheduleGroupOwner } from "./groupPolicy";

const MAX_GROUPS = 20;
const MAX_GROUP_MEMBERS = 20;

const userValidator = v.object({
  _id: v.id("users"),
  uniqueId: v.string(),
  firstName: v.string(),
  lastName: v.string(),
});

const groupSummaryValidator = v.object({
  id: v.id("studentScheduleGroups"),
  name: v.string(),
  memberCount: v.number(),
  createdAt: v.string(),
  updatedAt: v.string(),
});

const groupMemberValidator = v.object({
  id: v.id("studentScheduleGroupMembers"),
  user: userValidator,
  friendshipActive: v.boolean(),
  visibility: v.union(v.literal("PUBLIC"), v.literal("PRIVATE"), v.literal("NONE")),
  schedule: v.union(studentScheduleRecordValidator, v.null()),
});

const sharedClassClusterValidator = v.object({
  key: v.string(),
  weekday: v.union(
    v.literal("MONDAY"),
    v.literal("TUESDAY"),
    v.literal("WEDNESDAY"),
    v.literal("THURSDAY"),
    v.literal("FRIDAY"),
  ),
  periodNumber: v.number(),
  className: v.string(),
  courseId: v.union(v.id("courses"), v.null()),
  attendeeUserIds: v.array(v.id("users")),
  participantCount: v.number(),
  everyoneShared: v.boolean(),
});

function normalizeGroupName(name: string) {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (!normalized) throw new ConvexError("Group name is required.");
  if (normalized.length > 60) throw new ConvexError("Group names can be at most 60 characters.");
  return normalized;
}

async function requireOwnedGroup(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"studentScheduleGroups">,
  ownerId: Id<"users">,
) {
  const group = await ctx.db.get(groupId);
  if (!group || !isScheduleGroupOwner(group.ownerId, ownerId)) {
    throw new ConvexError("Schedule group not found.");
  }
  return group;
}

async function acceptedFriendIds(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  const [outgoing, incoming] = await Promise.all([
    ctx.db
      .query("studentScheduleFriends")
      .withIndex("by_requesterId_and_status_and_acceptedAt", (q) =>
        q.eq("requesterId", userId).eq("status", "ACCEPTED"),
      )
      .take(100),
    ctx.db
      .query("studentScheduleFriends")
      .withIndex("by_addresseeId_and_status_and_acceptedAt", (q) =>
        q.eq("addresseeId", userId).eq("status", "ACCEPTED"),
      )
      .take(100),
  ]);
  return Array.from(
    new Set([
      ...outgoing.map((row) => row.addresseeId),
      ...incoming.map((row) => row.requesterId),
    ]),
  );
}

async function toGroupSummary(
  ctx: QueryCtx,
  group: Doc<"studentScheduleGroups">,
) {
  const members = await ctx.db
    .query("studentScheduleGroupMembers")
    .withIndex("by_groupId_and_addedAt", (q) => q.eq("groupId", group._id))
    .take(MAX_GROUP_MEMBERS + 1);
  return {
    id: group._id,
    name: group.name,
    memberCount: members.length,
    createdAt: new Date(group.createdAt).toISOString(),
    updatedAt: new Date(group.updatedAt).toISOString(),
  };
}

export const listMine = query({
  args: {},
  returns: v.array(groupSummaryValidator),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const groups = await ctx.db
      .query("studentScheduleGroups")
      .withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(MAX_GROUPS);
    return await Promise.all(groups.map((group) => toGroupSummary(ctx, group)));
  },
});

export const listEligibleFriends = query({
  args: {},
  returns: v.array(userValidator),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const friendIds = await acceptedFriendIds(ctx, user._id);
    const friends = [];
    for (const friendId of friendIds) {
      const friend = await ctx.db.get(friendId);
      if (friend?.isActive && isStudentUser(friend)) friends.push(serializeUser(friend));
    }
    return friends.sort(
      (left, right) =>
        left.lastName.localeCompare(right.lastName) ||
        left.firstName.localeCompare(right.firstName),
    );
  },
});

export const get = query({
  args: { groupId: v.id("studentScheduleGroups") },
  returns: v.object({
    group: groupSummaryValidator,
    owner: userValidator,
    ownerSchedule: v.union(studentScheduleRecordValidator, v.null()),
    members: v.array(groupMemberValidator),
    clusters: v.array(sharedClassClusterValidator),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const group = await requireOwnedGroup(ctx, args.groupId, user._id);
    const memberRows = await ctx.db
      .query("studentScheduleGroupMembers")
      .withIndex("by_groupId_and_addedAt", (q) => q.eq("groupId", group._id))
      .take(MAX_GROUP_MEMBERS + 1);
    const ownerSchedule = await serializeScheduleForUser(ctx, user._id);
    const participants: Array<{
      userId: Id<"users">;
      entries: NonNullable<typeof ownerSchedule>["entries"] | null;
    }> = [{ userId: user._id, entries: ownerSchedule?.entries ?? null }];
    const members = [];

    for (const memberRow of memberRows) {
      const member = await ctx.db.get(memberRow.userId);
      if (!member) {
        participants.push({ userId: memberRow.userId, entries: null });
        continue;
      }
      const friendship = await getFriendshipBetween(ctx, user._id, member._id);
      const friendshipActive = friendship?.status === "ACCEPTED";
      const schedule =
        friendshipActive && member.isActive && isStudentUser(member)
          ? await serializeScheduleForUser(ctx, member._id)
          : null;
      const visibility = studentVisibility(schedule);
      const visibleSchedule = visibility === "PUBLIC" ? schedule : null;
      participants.push({ userId: member._id, entries: visibleSchedule?.entries ?? null });
      members.push({
        id: memberRow._id,
        user: serializeUser(member),
        friendshipActive,
        visibility,
        schedule: visibleSchedule,
      });
    }

    members.sort(
      (left, right) =>
        left.user.lastName.localeCompare(right.user.lastName) ||
        left.user.firstName.localeCompare(right.user.firstName),
    );
    return {
      group: await toGroupSummary(ctx, group),
      owner: serializeUser(user),
      ownerSchedule,
      members,
      clusters: clusterSharedClasses(participants),
    };
  },
});

export const create = mutation({
  args: { name: v.string() },
  returns: v.object({ id: v.id("studentScheduleGroups") }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const existing = await ctx.db
      .query("studentScheduleGroups")
      .withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", user._id))
      .take(MAX_GROUPS + 1);
    if (existing.length >= MAX_GROUPS) throw new ConvexError("You can create up to 20 groups.");
    const now = Date.now();
    const id = await ctx.db.insert("studentScheduleGroups", {
      ownerId: user._id,
      name: normalizeGroupName(args.name),
      createdAt: now,
      updatedAt: now,
    });
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schedule.group_created",
      entityType: "studentScheduleGroup",
      entityId: id,
    });
    return { id };
  },
});

export const rename = mutation({
  args: { groupId: v.id("studentScheduleGroups"), name: v.string() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const group = await requireOwnedGroup(ctx, args.groupId, user._id);
    await ctx.db.patch(group._id, { name: normalizeGroupName(args.name), updatedAt: Date.now() });
    return { success: true };
  },
});

export const addMember = mutation({
  args: { groupId: v.id("studentScheduleGroups"), friendId: v.id("users") },
  returns: v.object({ id: v.id("studentScheduleGroupMembers") }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const group = await requireOwnedGroup(ctx, args.groupId, user._id);
    const friend = await ctx.db.get(args.friendId);
    if (!friend?.isActive || !isStudentUser(friend)) throw new ConvexError("Student not found.");
    const friendship = await getFriendshipBetween(ctx, user._id, friend._id);
    if (
      !canAddAcceptedFriendToGroup({
        ownerId: group.ownerId,
        actorId: user._id,
        friendId: friend._id,
        friendshipStatus: friendship?.status ?? null,
      })
    ) {
      throw new ConvexError("Only accepted friends can be added to a schedule group.");
    }
    const existingMember = await ctx.db
      .query("studentScheduleGroupMembers")
      .withIndex("by_groupId_and_userId", (q) =>
        q.eq("groupId", group._id).eq("userId", friend._id),
      )
      .unique();
    if (existingMember) return { id: existingMember._id };
    const members = await ctx.db
      .query("studentScheduleGroupMembers")
      .withIndex("by_groupId_and_addedAt", (q) => q.eq("groupId", group._id))
      .take(MAX_GROUP_MEMBERS + 1);
    if (members.length >= MAX_GROUP_MEMBERS) {
      throw new ConvexError("Schedule groups can include up to 20 friends.");
    }
    const id = await ctx.db.insert("studentScheduleGroupMembers", {
      groupId: group._id,
      userId: friend._id,
      addedAt: Date.now(),
    });
    await ctx.db.patch(group._id, { updatedAt: Date.now() });
    return { id };
  },
});

export const removeMember = mutation({
  args: { groupId: v.id("studentScheduleGroups"), friendId: v.id("users") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const group = await requireOwnedGroup(ctx, args.groupId, user._id);
    const member = await ctx.db
      .query("studentScheduleGroupMembers")
      .withIndex("by_groupId_and_userId", (q) =>
        q.eq("groupId", group._id).eq("userId", args.friendId),
      )
      .unique();
    if (member) {
      await ctx.db.delete(member._id);
      await ctx.db.patch(group._id, { updatedAt: Date.now() });
    }
    return { success: true };
  },
});

export const remove = mutation({
  args: { groupId: v.id("studentScheduleGroups") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const group = await requireOwnedGroup(ctx, args.groupId, user._id);
    const members = await ctx.db
      .query("studentScheduleGroupMembers")
      .withIndex("by_groupId_and_addedAt", (q) => q.eq("groupId", group._id))
      .take(MAX_GROUP_MEMBERS + 1);
    for (const member of members) await ctx.db.delete(member._id);
    await ctx.db.delete(group._id);
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schedule.group_deleted",
      entityType: "studentScheduleGroup",
      entityId: group._id,
    });
    return { success: true };
  },
});
