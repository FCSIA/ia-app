import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../../lib/currentUser";
import { logAuditEvent } from "../audit/_lib";
import { getClubContext } from "./access";

const MAX_GROUPS = 100;
const MAX_GROUP_RULES = 100;
const MAX_GROUP_MEMBER_ROWS = 500;

const groupRuleValidator = v.union(
  v.object({ kind: v.literal("ROLE"), roleId: v.id("clubRoles") }),
  v.object({ kind: v.literal("PERSON"), userId: v.id("users") }),
  v.object({ kind: v.literal("UNIT"), unitId: v.id("clubUnits") }),
);

const groupSummaryValidator = v.object({
  _id: v.id("clubPeopleGroups"),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  position: v.number(),
  rules: v.array(groupRuleValidator),
});

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

async function requireGroupManager(ctx: Parameters<typeof getClubContext>[0], clubId: Id<"clubs">, user: Awaited<ReturnType<typeof getCurrentAppUser>>) {
  const context = await getClubContext(ctx, clubId, user);
  if (!context.permissions.manageRoles) {
    throw new ConvexError("You do not have permission to manage people groups");
  }
  return context;
}

async function requireGroup(ctx: Parameters<typeof getClubContext>[0], clubId: Id<"clubs">, groupId: Id<"clubPeopleGroups">) {
  const group = await ctx.db.get(groupId);
  if (!group || group.clubId !== clubId) throw new ConvexError("People group not found");
  return group;
}

async function validateRules(
  ctx: Parameters<typeof getClubContext>[0],
  clubId: Id<"clubs">,
  rules: Array<{ kind: "ROLE"; roleId: Id<"clubRoles"> } | { kind: "PERSON"; userId: Id<"users"> } | { kind: "UNIT"; unitId: Id<"clubUnits"> }>,
) {
  if (rules.length > MAX_GROUP_RULES) {
    throw new ConvexError(`A people group can contain up to ${MAX_GROUP_RULES} rules`);
  }
  const seen = new Set<string>();
  for (const rule of rules) {
    const id = rule.kind === "ROLE" ? rule.roleId : rule.kind === "PERSON" ? rule.userId : rule.unitId;
    const key = `${rule.kind}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (rule.kind === "ROLE") {
      const role = await ctx.db.get(rule.roleId);
      if (!role || role.clubId !== clubId) throw new ConvexError("People group role not found");
    } else if (rule.kind === "PERSON") {
      const member = await ctx.db.query("clubMembers").withIndex("by_clubId_and_userId", (q) =>
        q.eq("clubId", clubId).eq("userId", rule.userId),
      ).unique();
      if (!member) throw new ConvexError("People groups can only include club members");
    } else {
      const unit = await ctx.db.get(rule.unitId);
      if (!unit || unit.clubId !== clubId || !unit.isActive) throw new ConvexError("People group unit not found");
    }
  }
  return [...seen];
}

async function rulesForGroup(ctx: Parameters<typeof getClubContext>[0], groupId: Id<"clubPeopleGroups">) {
  return ctx.db.query("clubPeopleGroupRules")
    .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
    .take(MAX_GROUP_RULES);
}

export const list = query({
  args: { clubId: v.id("clubs") },
  returns: v.object({ canManage: v.boolean(), groups: v.array(groupSummaryValidator) }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    if (!context.canAccessWorkspace) return { canManage: false, groups: [] };
    const groups = await ctx.db.query("clubPeopleGroups")
      .withIndex("by_clubId_and_position", (q) => q.eq("clubId", args.clubId))
      .take(MAX_GROUPS);
    return {
      canManage: context.permissions.manageRoles,
      groups: await Promise.all(groups.map(async (group) => ({
        _id: group._id,
        name: group.name,
        description: group.description ?? null,
        position: group.position,
        rules: (await rulesForGroup(ctx, group._id)).map((rule) =>
          rule.kind === "ROLE"
            ? { kind: "ROLE" as const, roleId: rule.roleId! }
            : rule.kind === "PERSON"
              ? { kind: "PERSON" as const, userId: rule.userId! }
              : { kind: "UNIT" as const, unitId: rule.unitId! },
        ),
      }))),
    };
  },
});

export const members = query({
  args: { clubId: v.id("clubs"), groupId: v.id("clubPeopleGroups") },
  returns: v.object({ memberIds: v.array(v.id("users")) }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    if (!context.canAccessWorkspace) return { memberIds: [] };
    await requireGroup(ctx, args.clubId, args.groupId);
    const rules = await rulesForGroup(ctx, args.groupId);
    const memberIds = new Set<Id<"users">>();
    const units = await ctx.db.query("clubUnits")
      .withIndex("by_clubId_and_isActive_and_position", (q) =>
        q.eq("clubId", args.clubId).eq("isActive", true),
      )
      .take(250);
    const children = new Map<Id<"clubUnits"> | null, Id<"clubUnits">[]>();
    for (const unit of units) {
      const siblings = children.get(unit.parentUnitId ?? null) ?? [];
      siblings.push(unit._id);
      children.set(unit.parentUnitId ?? null, siblings);
    }
    for (const rule of rules) {
      if (rule.kind === "PERSON" && rule.userId) {
        memberIds.add(rule.userId);
      } else if (rule.kind === "ROLE" && rule.roleId) {
        const [roleMembers, legacyRoleMembers] = await Promise.all([
          ctx.db.query("clubMembers").withIndex("by_clubId_and_roleId", (q) =>
            q.eq("clubId", args.clubId).eq("roleId", rule.roleId),
          ).take(MAX_GROUP_MEMBER_ROWS),
          ctx.db.query("clubMembers").withIndex("by_clubId_and_customRoleId", (q) =>
            q.eq("clubId", args.clubId).eq("customRoleId", rule.roleId),
          ).take(MAX_GROUP_MEMBER_ROWS),
        ]);
        for (const member of [...roleMembers, ...legacyRoleMembers]) memberIds.add(member.userId);
      } else if (rule.kind === "UNIT" && rule.unitId) {
        const unitIds = [rule.unitId];
        for (let index = 0; index < unitIds.length; index += 1) {
          unitIds.push(...(children.get(unitIds[index]) ?? []));
        }
        const memberships = await Promise.all(unitIds.map((unitId) =>
          ctx.db.query("clubUnitMembers").withIndex("by_clubId_and_unitId", (q) =>
            q.eq("clubId", args.clubId).eq("unitId", unitId),
          ).take(MAX_GROUP_MEMBER_ROWS),
        ));
        for (const membershipRows of memberships) {
          for (const membership of membershipRows) memberIds.add(membership.userId);
        }
      }
    }
    const validMemberIds = new Set(
      (await Promise.all([...memberIds].map((memberId) =>
        ctx.db.query("clubMembers").withIndex("by_clubId_and_userId", (q) =>
          q.eq("clubId", args.clubId).eq("userId", memberId),
        ).unique(),
      ))).filter((member): member is NonNullable<typeof member> => member !== null)
        .map((member) => member.userId),
    );
    return { memberIds: [...validMemberIds] };
  },
});

export const create = mutation({
  args: {
    clubId: v.id("clubs"),
    name: v.string(),
    description: v.optional(v.string()),
    rules: v.array(groupRuleValidator),
  },
  returns: v.id("clubPeopleGroups"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await requireGroupManager(ctx, args.clubId, user);
    const name = normalizeName(args.name);
    if (!name) throw new ConvexError("Group name is required");
    if (name.length > 80) throw new ConvexError("Group names must be 80 characters or fewer");
    const groups = await ctx.db.query("clubPeopleGroups")
      .withIndex("by_clubId_and_position", (q) => q.eq("clubId", args.clubId))
      .take(MAX_GROUPS + 1);
    if (groups.length >= MAX_GROUPS) throw new ConvexError("A club can have up to 100 people groups");
    const duplicate = groups.some((group) => group.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (duplicate) throw new ConvexError("A people group with this name already exists");
    const rules = await validateRules(ctx, args.clubId, args.rules);
    if (!rules.length) throw new ConvexError("A people group needs at least one rule");
    const now = Date.now();
    const groupId = await ctx.db.insert("clubPeopleGroups", {
      clubId: args.clubId,
      name,
      description: normalizeName(args.description ?? "") || undefined,
      position: groups.reduce((position, group) => Math.max(position, group.position + 1), 0),
      createdById: user._id,
      createdAt: now,
      updatedAt: now,
    });
    const insertedRules = new Set<string>();
    for (const rule of args.rules) {
      const id = rule.kind === "ROLE" ? rule.roleId : rule.kind === "PERSON" ? rule.userId : rule.unitId;
      const key = `${rule.kind}:${id}`;
      if (!rules.includes(key) || insertedRules.has(key)) continue;
      insertedRules.add(key);
      await ctx.db.insert("clubPeopleGroupRules", {
        clubId: args.clubId,
        groupId,
        kind: rule.kind,
        ...(rule.kind === "ROLE" ? { roleId: rule.roleId } : {}),
        ...(rule.kind === "PERSON" ? { userId: rule.userId } : {}),
        ...(rule.kind === "UNIT" ? { unitId: rule.unitId } : {}),
        createdAt: now,
      });
    }
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_PEOPLE_GROUP_CREATED",
      entityType: "ClubPeopleGroup",
      entityId: groupId,
      meta: { clubId: args.clubId, ruleCount: insertedRules.size },
    });
    return groupId;
  },
});

export const update = mutation({
  args: {
    clubId: v.id("clubs"),
    groupId: v.id("clubPeopleGroups"),
    name: v.string(),
    description: v.optional(v.string()),
    rules: v.array(groupRuleValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await requireGroupManager(ctx, args.clubId, user);
    const group = await requireGroup(ctx, args.clubId, args.groupId);
    const name = normalizeName(args.name);
    if (!name) throw new ConvexError("Group name is required");
    if (name.length > 80) throw new ConvexError("Group names must be 80 characters or fewer");
    const groups = await ctx.db.query("clubPeopleGroups")
      .withIndex("by_clubId_and_name", (q) => q.eq("clubId", args.clubId))
      .take(MAX_GROUPS);
    if (groups.some((candidate) => candidate._id !== group._id && candidate.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new ConvexError("A people group with this name already exists");
    }
    const validRules = await validateRules(ctx, args.clubId, args.rules);
    if (!validRules.length) throw new ConvexError("A people group needs at least one rule");
    const existingRules = await rulesForGroup(ctx, group._id);
    for (const rule of existingRules) await ctx.db.delete(rule._id);
    const now = Date.now();
    await ctx.db.patch(group._id, {
      name,
      description: normalizeName(args.description ?? "") || undefined,
      updatedAt: now,
    });
    const insertedRules = new Set<string>();
    for (const rule of args.rules) {
      const id = rule.kind === "ROLE" ? rule.roleId : rule.kind === "PERSON" ? rule.userId : rule.unitId;
      const key = `${rule.kind}:${id}`;
      if (!validRules.includes(key) || insertedRules.has(key)) continue;
      insertedRules.add(key);
      await ctx.db.insert("clubPeopleGroupRules", {
        clubId: args.clubId,
        groupId: group._id,
        kind: rule.kind,
        ...(rule.kind === "ROLE" ? { roleId: rule.roleId } : {}),
        ...(rule.kind === "PERSON" ? { userId: rule.userId } : {}),
        ...(rule.kind === "UNIT" ? { unitId: rule.unitId } : {}),
        createdAt: now,
      });
    }
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_PEOPLE_GROUP_UPDATED",
      entityType: "ClubPeopleGroup",
      entityId: group._id,
      meta: { clubId: args.clubId, ruleCount: insertedRules.size },
    });
    return null;
  },
});

export const remove = mutation({
  args: { clubId: v.id("clubs"), groupId: v.id("clubPeopleGroups") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await requireGroupManager(ctx, args.clubId, user);
    const group = await requireGroup(ctx, args.clubId, args.groupId);
    for (const rule of await rulesForGroup(ctx, group._id)) await ctx.db.delete(rule._id);
    await ctx.db.delete(group._id);
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_PEOPLE_GROUP_DELETED",
      entityType: "ClubPeopleGroup",
      entityId: group._id,
      meta: { clubId: args.clubId, name: group.name },
    });
    return null;
  },
});
