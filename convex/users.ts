import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { authComponent, createAuth } from "./auth";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { logAuditEvent } from "./lib/audit";
import {
  getCurrentAppUser,
  requireAnyRole,
  toPublicUser,
} from "./lib/currentUser";
import { type AppRole, USER_MANAGEMENT_ROLES } from "./lib/roles";
import {
  appRoleValidator,
  appUserPublicValidator,
  pathwayValidator,
} from "./validators";

const temporaryPasswordAlphabet =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

const createUserResultValidator = v.object({
  user: appUserPublicValidator,
  temporaryPassword: v.union(v.string(), v.null()),
});

type Pathway = "INFORMATION_TECHNOLOGY" | "HEALTH_SCIENCE" | "ENGINEERING";
type UserRoleGroup = "students" | "teachers" | "student-admin" | "other" | "all";

type CreateLinkedUserArgs = {
  uniqueId: string;
  firstName: string;
  lastName: string;
  gradeLevel?: number;
  major?: Pathway;
  minor?: Pathway;
  email?: string;
  password?: string;
  roles?: AppRole[];
  mustResetPassword?: boolean;
};

function normalizeUniqueId(uniqueId: string) {
  return uniqueId.trim().toUpperCase();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildStudentEmail(uniqueId: string) {
  return `${uniqueId.toLowerCase()}@fcstu.org`;
}

function fullName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

function searchText(args: {
  uniqueId: string;
  firstName: string;
  lastName: string;
  email?: string;
}) {
  return [
    args.uniqueId,
    args.firstName,
    args.lastName,
    args.email,
    fullName(args.firstName, args.lastName),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function classifyRoles(roles: AppRole[]) {
  const isStudent = roles.some((role) =>
    ["STUDENT", "STUDENT_LEADER"].includes(role),
  );
  const isTeacherStaff = roles.some((role) =>
    ["TEACHER", "SPONSOR"].includes(role),
  );
  const isStudentAdmin = roles.includes("STUDENT_ADMIN");
  const isPrivileged = roles.some((role) =>
    ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"].includes(role),
  );

  return {
    isStudent,
    isTeacherStaff,
    isStudentAdmin,
    isOtherRole: !isStudent && !isTeacherStaff && !isStudentAdmin && isPrivileged,
  };
}

function generateTemporaryPassword(length = 12) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) =>
    temporaryPasswordAlphabet[byte % temporaryPasswordAlphabet.length],
  ).join("");
}

function betterAuthRoleForAppRoles(roles: string[]) {
  if (roles.includes("ADMIN") || roles.includes("SUPER_ADMIN")) {
    return "admin";
  }
  if (roles.includes("SUPPORT_STAFF")) {
    return "support_staff";
  }
  return "user";
}

async function assertUniqueUserKeys(
  ctx: MutationCtx,
  uniqueId: string,
  email: string,
) {
  const existingUniqueId = await ctx.db
    .query("users")
    .withIndex("by_uniqueId", (q) => q.eq("uniqueId", uniqueId))
    .unique();
  if (existingUniqueId) {
    throw new ConvexError("Unique ID already exists.");
  }

  const existingEmail = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  if (existingEmail) {
    throw new ConvexError("Email already exists.");
  }
}

async function createLinkedUser(ctx: MutationCtx, args: CreateLinkedUserArgs) {
  const uniqueId = normalizeUniqueId(args.uniqueId);
  const roles: AppRole[] = args.roles?.length ? args.roles : ["STUDENT"];
  const email = normalizeEmail(args.email ?? buildStudentEmail(uniqueId));
  const password = args.password ?? generateTemporaryPassword();
  const now = Date.now();

  await assertUniqueUserKeys(ctx, uniqueId, email);

  const auth = createAuth(ctx);
  const authUser = await auth.api.createUser({
    body: {
      email,
      name: fullName(args.firstName, args.lastName),
      password,
      role: betterAuthRoleForAppRoles(roles),
      data: {
        username: uniqueId,
        displayUsername: uniqueId,
      },
    },
  });

  const userId = await ctx.db.insert("users", {
    authUserId: authUser.user.id,
    uniqueId,
    firstName: args.firstName.trim(),
    lastName: args.lastName.trim(),
    gradeLevel: args.gradeLevel,
    major: args.major,
    minor: args.minor,
    email,
    roles,
    ...classifyRoles(roles),
    isActive: true,
    mustResetPassword: args.mustResetPassword ?? true,
    dashboardLayout: [],
    searchText: searchText({
      uniqueId,
      firstName: args.firstName,
      lastName: args.lastName,
      email,
    }),
    createdAt: now,
    updatedAt: now,
  });

  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError("Failed to create user.");
  }

  return {
    user: toPublicUser(user),
    temporaryPassword: args.password ? null : password,
  };
}

export const me = query({
  args: {},
  returns: appUserPublicValidator,
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    return toPublicUser(user);
  },
});

export const changePassword = mutation({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);

    await auth.api.changePassword({
      body: {
        currentPassword: args.currentPassword,
        newPassword: args.newPassword,
      },
      headers,
    });

    if (user.mustResetPassword) {
      await ctx.db.patch(user._id, {
        mustResetPassword: false,
        updatedAt: Date.now(),
      });
    }

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "user.password_changed",
      entityType: "user",
      entityId: user._id,
    });

    return null;
  },
});

const userRoleGroupValidator = v.union(
  v.literal("students"),
  v.literal("teachers"),
  v.literal("student-admin"),
  v.literal("other"),
  v.literal("all"),
);

const listUsersResultValidator = v.object({
  page: v.array(appUserPublicValidator),
  isDone: v.boolean(),
  continueCursor: v.string(),
});

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

    const requestedRoles: AppRole[] = args.roles?.length
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
      roles: requestedRoles,
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

export const bootstrapFirstSuperAdmin = mutation({
  args: {
    bootstrapSecret: v.string(),
    uniqueId: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    password: v.string(),
  },
  returns: createUserResultValidator,
  handler: async (ctx, args) => {
    const expectedSecret = process.env.BOOTSTRAP_SECRET;
    if (!expectedSecret || args.bootstrapSecret !== expectedSecret) {
      throw new ConvexError("Invalid bootstrap secret.");
    }

    const existingUser = await ctx.db.query("users").first();
    if (existingUser) {
      throw new ConvexError("Bootstrap is only allowed before users exist.");
    }

    const result = await createLinkedUser(ctx, {
      uniqueId: args.uniqueId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      password: args.password,
      roles: ["SUPER_ADMIN"],
      mustResetPassword: false,
    });

    await logAuditEvent(ctx, {
      action: "user.bootstrap_super_admin",
      entityType: "user",
      entityId: result.user.id,
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
      roles: nextRoles,
      ...classifyRoles(nextRoles),
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

export const updateDashboardLayout = mutation({
  args: {
    layout: v.array(v.string()),
  },
  returns: appUserPublicValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await ctx.db.patch(user._id, {
      dashboardLayout: args.layout,
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(user._id);
    if (!updated) {
      throw new ConvexError("User not found.");
    }
    return toPublicUser(updated);
  },
});
