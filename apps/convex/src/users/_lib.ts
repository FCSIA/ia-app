import { ConvexError, v } from "convex/values";
import { authComponent, createAuth } from "../auth";
import type { MutationCtx } from "../_generated/server";
import { toPublicUser } from "../lib/currentUser";
import { type AppRole } from "../lib/roles";
import {
  appUserPublicValidator,
} from "../validators";

export const temporaryPasswordAlphabet =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export const createUserResultValidator = v.object({
  user: appUserPublicValidator,
  temporaryPassword: v.union(v.string(), v.null()),
});

export const userRoleGroupValidator = v.union(
  v.literal("students"),
  v.literal("teachers"),
  v.literal("student-admin"),
  v.literal("other"),
  v.literal("all"),
);

export const listUsersResultValidator = v.object({
  page: v.array(appUserPublicValidator),
  isDone: v.boolean(),
  continueCursor: v.string(),
});

export type Pathway = "INFORMATION_TECHNOLOGY" | "HEALTH_SCIENCE" | "ENGINEERING";

export type CreateLinkedUserArgs = {
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

export function normalizeUniqueId(uniqueId: string) {
  return uniqueId.trim().toUpperCase();
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function buildStudentEmail(uniqueId: string) {
  return `${uniqueId.toLowerCase()}@fcstu.org`;
}

export function fullName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

export function searchText(args: {
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

export function classifyRoles(roles: AppRole[]) {
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

export function generateTemporaryPassword(length = 12) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) =>
    temporaryPasswordAlphabet[byte % temporaryPasswordAlphabet.length],
  ).join("");
}

export function betterAuthRoleForAppRoles(roles: string[]) {
  if (roles.includes("ADMIN") || roles.includes("SUPER_ADMIN")) {
    return "admin";
  }
  if (roles.includes("SUPPORT_STAFF")) {
    return "support_staff";
  }
  return "user";
}

export async function assertUniqueUserKeys(
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

export async function createLinkedUser(ctx: MutationCtx, args: CreateLinkedUserArgs) {
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

export function isStudentUser(user: Doc<"users">) {
  return user.roles.some((role) => ["STUDENT", "STUDENT_LEADER", "STUDENT_ADMIN"].includes(role));
}
