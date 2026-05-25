import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { logAuditEvent } from "../audit/lib";
import {
  getCurrentAppUser,
  requireAnyRole,
  toPublicUser,
} from "../lib/currentUser";
import { USER_MANAGEMENT_ROLES } from "../lib/roles";
import {
  appRoleValidator,
  appUserPublicValidator,
  pathwayValidator,
} from "../validators";
import {
  authComponent,
  createAuth,
} from "../auth";
import {
  classifyRoles,
  createLinkedUser,
  createUserResultValidator,
  generateTemporaryPassword,
  listUsersResultValidator,
  userRoleGroupValidator,
} from "./lib";

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    roleGroup: v.optional(userRoleGroupValidator),
  },
  returns: listUsersResultValidator,
  handler: async (ctx, args) => {
    const actor = await getCurrentAppUser(ctx);
    requireAnyRole(actor, [...USER_MANAGEMENT_ROLES, "SUPPORT_STAFF"]);

    const roleGroup = args.roleGroup ?? "all";
    const search = args.search?.trim().toLowerCase();

    const page = search
      ? await ctx.db
          .query("users")
          .withSearchIndex("search_users", (q) => {
            let searchQuery = q.search("searchText", search);
            if (roleGroup === "students") {
              searchQuery = searchQuery.eq("isStudent", true);
            } else if (roleGroup === "teachers") {
              searchQuery = searchQuery.eq("isTeacherStaff", true);
            } else if (roleGroup === "student-admin") {
              searchQuery = searchQuery.eq("isStudentAdmin", true);
            } else if (roleGroup === "other") {
              searchQuery = searchQuery.eq("isOtherRole", true);
            }
            return searchQuery;
          })
          .paginate(args.paginationOpts)
      : roleGroup === "students"
        ? await ctx.db
            .query("users")
            .withIndex("by_isStudent_and_lastName_and_firstName", (q) =>
              q.eq("isStudent", true),
            )
            .paginate(args.paginationOpts)
        : roleGroup === "teachers"
          ? await ctx.db
              .query("users")
              .withIndex("by_isTeacherStaff_and_lastName_and_firstName", (q) =>
                q.eq("isTeacherStaff", true),
              )
              .paginate(args.paginationOpts)
          : roleGroup === "student-admin"
            ? await ctx.db
                .query("users")
                .withIndex(
                  "by_isStudentAdmin_and_lastName_and_firstName",
                  (q) => q.eq("isStudentAdmin", true),
                )
                .paginate(args.paginationOpts)
            : roleGroup === "other"
              ? await ctx.db
                  .query("users")
                  .withIndex("by_isOtherRole_and_lastName_and_firstName", (q) =>
                    q.eq("isOtherRole", true),
                  )
                  .paginate(args.paginationOpts)
              : await ctx.db
                  .query("users")
                  .withIndex("by_lastName_and_firstName")
                  .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map(toPublicUser),
    };
  },
});

export const createUser = mutation({
  args: {
    uniqueId: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    gradeLevel: v.optional(v.number()),
    major: v.optional(pathwayValidator),
    minor: v.optional(pathwayValidator),
    email: v.optional(v.string()),
    password: v.optional(v.string()),
    roles: v.optional(v.array(appRoleValidator)),
  },
  returns: createUserResultValidator,
  handler: async (ctx, args) => {
    const actor = await getCurrentAppUser(ctx);
    requireAnyRole(actor, [...USER_MANAGEMENT_ROLES]);

    const requestedRoles = args.roles?.length
      ? args.roles
      : ["STUDENT"];
    const createsPrivilegedUser = requestedRoles.some((role) =>
      ["ADMIN", "SUPER_ADMIN"].includes(role),
    );
    if (createsPrivilegedUser && !actor.roles.includes("SUPER_ADMIN")) {
      throw new ConvexError("Only super admins can create admin accounts.");
    }

    const result = await createLinkedUser(ctx, {
      ...args,
      roles: requestedRoles as any,
    });

    await logAuditEvent(ctx, {
      actorId: actor._id,
      action: "user.created",
      entityType: "user",
      entityId: result.user.id,
      meta: { roles: requestedRoles },
    });

    return result;
  },
});

export const activate = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: appUserPublicValidator,
  handler: async (ctx, args) => {
    const actor = await getCurrentAppUser(ctx);
    requireAnyRole(actor, [...USER_MANAGEMENT_ROLES]);

    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError("User not found.");
    }

    await ctx.db.patch(target._id, {
      isActive: true,
      updatedAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      actorId: actor._id,
      action: "user.activated",
      entityType: "user",
      entityId: target._id,
    });

    const updated = await ctx.db.get(target._id);
    if (!updated) {
      throw new ConvexError("User not found.");
    }
    return toPublicUser(updated);
  },
});

export const deactivate = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: appUserPublicValidator,
  handler: async (ctx, args) => {
    const actor = await getCurrentAppUser(ctx);
    requireAnyRole(actor, [...USER_MANAGEMENT_ROLES]);

    if (actor._id === args.userId) {
      throw new ConvexError("You cannot deactivate your own account.");
    }

    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError("User not found.");
    }

    const targetIsPrivileged = target.roles.some((role) =>
      ["ADMIN", "SUPER_ADMIN"].includes(role),
    );
    if (targetIsPrivileged && !actor.roles.includes("SUPER_ADMIN")) {
      throw new ConvexError("Only super admins can deactivate admin accounts.");
    }

    await ctx.db.patch(target._id, {
      isActive: false,
      updatedAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      actorId: actor._id,
      action: "user.deactivated",
      entityType: "user",
      entityId: target._id,
    });

    const updated = await ctx.db.get(target._id);
    if (!updated) {
      throw new ConvexError("User not found.");
    }
    return toPublicUser(updated);
  },
});

export const assignRoles = mutation({
  args: {
    userId: v.id("users"),
    roles: v.array(appRoleValidator),
  },
  returns: appUserPublicValidator,
  handler: async (ctx, args) => {
    const actor = await getCurrentAppUser(ctx);
    requireAnyRole(actor, [...USER_MANAGEMENT_ROLES]);

    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError("User not found.");
    }

    const nextRoles = Array.from(new Set(args.roles));
    if (nextRoles.length === 0) {
      throw new ConvexError("User must have at least one role.");
    }

    const nextPrivileged = nextRoles.some((role) =>
      ["ADMIN", "SUPER_ADMIN"].includes(role),
    );
    const currentPrivileged = target.roles.some((role) =>
      ["ADMIN", "SUPER_ADMIN"].includes(role),
    );
    if (
      (nextPrivileged || currentPrivileged) &&
      !actor.roles.includes("SUPER_ADMIN")
    ) {
      throw new ConvexError("Only super admins can change admin roles.");
    }

    await ctx.db.patch(target._id, {
      roles: nextRoles as any,
      ...classifyRoles(nextRoles as any),
      updatedAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      actorId: actor._id,
      action: "user.roles_assigned",
      entityType: "user",
      entityId: target._id,
      meta: { roles: nextRoles },
    });

    const updated = await ctx.db.get(target._id);
    if (!updated) {
      throw new ConvexError("User not found.");
    }
    return toPublicUser(updated);
  },
});

export const resetPassword = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    temporaryPassword: v.string(),
  }),
  handler: async (ctx, args) => {
    const actor = await getCurrentAppUser(ctx);
    requireAnyRole(actor, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"]);

    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError("User not found.");
    }

    const targetIsPrivileged = target.roles.some((role) =>
      ["ADMIN", "SUPER_ADMIN"].includes(role),
    );
    if (targetIsPrivileged && !actor.roles.includes("SUPER_ADMIN")) {
      throw new ConvexError("Only super admins can reset admin passwords.");
    }

    if (
      actor.roles.includes("SUPPORT_STAFF") &&
      !target.roles.some((role) =>
        ["STUDENT", "STUDENT_LEADER", "STUDENT_ADMIN"].includes(role),
      )
    ) {
      throw new ConvexError("Support staff can only reset student passwords.");
    }

    if (!target.authUserId) {
      throw new ConvexError("User is not linked to an auth account.");
    }

    const temporaryPassword = generateTemporaryPassword();
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);

    await auth.api.setUserPassword({
      body: {
        userId: target.authUserId,
        newPassword: temporaryPassword,
      },
      headers,
    });

    await ctx.db.patch(target._id, {
      mustResetPassword: true,
      updatedAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      actorId: actor._id,
      action: "user.password_reset",
      entityType: "user",
      entityId: target._id,
    });

    return { temporaryPassword };
  },
});
