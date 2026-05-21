import { ConvexError, v } from "convex/values";
import { authComponent, createAuth } from "./auth";
import { mutation, query, type MutationCtx } from "./_generated/server";
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
    isActive: true,
    mustResetPassword: args.mustResetPassword ?? true,
    dashboardLayout: [],
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

    return null;
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

    return await createLinkedUser(ctx, {
      ...args,
      roles: requestedRoles,
    });
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

    return await createLinkedUser(ctx, {
      uniqueId: args.uniqueId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      password: args.password,
      roles: ["SUPER_ADMIN"],
      mustResetPassword: false,
    });
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

    return { temporaryPassword };
  },
});
