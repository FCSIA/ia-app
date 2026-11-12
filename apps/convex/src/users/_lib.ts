import { ConvexError, v, type Infer } from "convex/values";
import { paginationResultValidator } from "convex/server";
import { hashPassword } from "better-auth/crypto";
import { createAuth } from "../auth";
import { components } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import {
  STAFF_ROLES,
  STUDENT_GROUP_ROLES,
  TEACHER_GROUP_ROLES,
  hasAnyRole,
  isStudent,
  type AppRole,
} from "../../../shared/roles";
import { incrementUserCounts, replaceUserCounts } from "../stats";
import { logAuditEvent } from "../audit/_lib";
import { schema } from "../schema";
import type { Pathway } from "../validators";
import { ONBOARDING_VERSION } from '../../../shared/onboarding';
import { MIN_PASSWORD_LENGTH } from '../../../shared/limits';

export const adminUserProfileValidator = schema
  .doc("users")
  .pick(
    "_id",
    "uniqueId",
    "firstName",
    "lastName",
    "preferredName",
    "roles",
    "gradeLevel",
    "major",
    "minor",
    "email",
    "isActive",
    "avatarUrl",
    "isDeveloper",
    "approvedBugCount",
    "bugTagColor",
  );

export const userSelfProfileValidator = adminUserProfileValidator.extend(
  schema
    .doc("users")
    .pick(
      "mustResetPassword",
      "canReviewFeedback",
      "dashboardLayout",
      "dashboardColumns",
      "dashboardNotes",
      "mobileTabLayout",
      "use24HourTime",
      "chatDoubleTapReaction",
      "customBackgroundUrl",
      "customBackgroundPalette",
      "customBackgroundTint",
      "customBackgroundBlur",
    ).fields,
);

/** Copies exactly the fields `validator` lists, so a mapper cannot drift from its validator. */
function pickFields<Fields extends Record<string, unknown>>(
  user: Doc<"users">,
  validator: { fields: Fields },
) {
  const picked: Record<string, unknown> = {};
  for (const key of Object.keys(validator.fields)) {
    picked[key] = user[key as keyof Doc<"users">];
  }
  return picked as Pick<Doc<"users">, Extract<keyof Fields, keyof Doc<"users">>>;
}

export function toUserSelfProfile(user: Doc<"users">) {
  return {
    ...pickFields(user, userSelfProfileValidator),
    use24HourTime: user.use24HourTime ?? false,
  } satisfies Infer<typeof userSelfProfileValidator>;
}

export function toAdminUserProfile(user: Doc<"users">) {
  return pickFields(user, adminUserProfileValidator) satisfies Infer<
    typeof adminUserProfileValidator
  >;
}

const temporaryPasswordAlphabet =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export const createUserResultValidator = v.object({
  user: adminUserProfileValidator,
  temporaryPassword: v.union(v.string(), v.null()),
});

export const userRoleGroupValidator = v.union(
  v.literal("students"),
  v.literal("teachers"),
  v.literal("student-admin"),
  v.literal("other"),
  v.literal("all"),
);

export type UserRoleGroup = Infer<typeof userRoleGroupValidator>;

export const listUsersResultValidator = paginationResultValidator(adminUserProfileValidator);

export const generatedCredentialValidator = v.object({
  firstName: v.string(),
  lastName: v.string(),
  uniqueId: v.string(),
  email: v.string(),
  temporaryPassword: v.string(),
});

export const userImportResultValidator = v.object({
  created: v.number(),
  skipped: v.number(),
  errors: v.array(v.string()),
  generatedCredentials: v.array(generatedCredentialValidator),
});

export const userImportRowResultValidator = v.union(
  v.object({
    kind: v.literal("created"),
    credential: v.optional(generatedCredentialValidator),
  }),
  v.object({
    kind: v.literal("skipped"),
    error: v.optional(v.string()),
  }),
);

export const studentExportRowValidator = v.object({
  firstName: v.string(),
  lastName: v.string(),
  uniqueId: v.string(),
  email: v.string(),
  gradeLevel: v.union(v.number(), v.null()),
  major: v.union(v.string(), v.null()),
  minor: v.union(v.string(), v.null()),
});

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

export function isGradeLevelOutOfRange(gradeLevel: number) {
  return gradeLevel < 9 || gradeLevel > 12;
}

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
  preferredName?: string;
}) {
  return [
    args.uniqueId,
    args.firstName,
    args.lastName,
    fullName(args.firstName, args.lastName),
    args.preferredName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function classifyRoles(roles: AppRole[]) {
  const isStudentGroup = hasAnyRole(roles, STUDENT_GROUP_ROLES);
  const isTeacherStaff = hasAnyRole(roles, TEACHER_GROUP_ROLES);
  const isStudentAdmin = roles.includes("STUDENT_ADMIN");
  const isPrivileged = hasAnyRole(roles, STAFF_ROLES);

  return {
    isStudent: isStudentGroup,
    isTeacherStaff,
    isStudentAdmin,
    isOtherRole:
      !isStudentGroup && !isTeacherStaff && !isStudentAdmin && isPrivileged,
  };
}

export function generateTemporaryPassword(length = 12) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (byte) =>
      temporaryPasswordAlphabet[byte % temporaryPasswordAlphabet.length],
  ).join("");
}

export function betterAuthRoleForAppRoles(roles: string[]) {
  if (roles.includes("SUPER_ADMIN")) {
    return "super_admin";
  }
  if (roles.includes("ADMIN")) {
    return "admin";
  }
  if (roles.includes("SUPPORT_STAFF")) {
    return "support_staff";
  }
  return "user";
}

export function assertInitialPasswordAllowed(
  password: string,
  uniqueId: string,
) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ConvexError("Password must be at least 6 characters.");
  }
  if (password.toUpperCase() === uniqueId.toUpperCase()) {
    throw new ConvexError("Password cannot match the user's unique ID.");
  }
}

export function privilegeTierForRoles(roles: readonly string[]) {
  if (roles.includes("SUPER_ADMIN")) return 4;
  if (roles.includes("ADMIN")) return 3;
  if (roles.includes("SUPPORT_STAFF")) return 2;
  if (roles.includes("STUDENT_ADMIN")) return 1;
  return 0;
}

export function isPrivilegeReduction(
  currentRoles: readonly string[],
  nextRoles: readonly string[],
) {
  return (
    privilegeTierForRoles(nextRoles) < privilegeTierForRoles(currentRoles) ||
    currentRoles.some((role) => !nextRoles.includes(role))
  );
}

export function assertCanActOn(
  actor: Pick<Doc<"users">, "roles">,
  target: Pick<Doc<"users">, "roles">,
) {
  if (
    privilegeTierForRoles(target.roles) >= privilegeTierForRoles(actor.roles)
  ) {
    throw new ConvexError(
      "You cannot act on an account with equal or greater privileges.",
    );
  }
}

export function assertCanResetPassword(
  actor: Pick<Doc<"users">, "roles">,
  target: Pick<Doc<"users">, "roles">,
) {
  assertCanActOn(actor, target);
  if (
    actor.roles.includes("SUPPORT_STAFF") &&
    !isStudent(target)
  ) {
    throw new ConvexError("Support staff can only reset student passwords.");
  }
}

export async function syncBetterAuthRole(
  ctx: MutationCtx,
  target: Pick<Doc<"users">, "authUserId" | "roles">,
) {
  if (!target.authUserId) return;
  await ctx.runMutation(components.betterAuth.adapter.updateOne, {
    input: {
      model: "user",
      where: [{ field: "_id", value: target.authUserId }],
      update: { role: betterAuthRoleForAppRoles(target.roles) },
    },
  });
}

export async function revokeBetterAuthSessions(
  ctx: MutationCtx,
  authUserId: string | undefined,
) {
  if (!authUserId) return;
  await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
    input: {
      model: "session",
      where: [{ field: "userId", value: authUserId }],
    },
    paginationOpts: { cursor: null, numItems: 1000 },
  });
}

export async function setBetterAuthPassword(
  ctx: MutationCtx,
  authUserId: string,
  password: string,
) {
  const account = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "account",
    where: [
      { field: "userId", value: authUserId },
      { field: "providerId", value: "credential" },
    ],
  })) as { _id: string } | null;

  if (!account) {
    throw new ConvexError("Credential account not found.");
  }

  await ctx.runMutation(components.betterAuth.adapter.updateOne, {
    input: {
      model: "account",
      where: [{ field: "_id", value: account._id }],
      update: {
        password: await hashPassword(password),
        updatedAt: Date.now(),
      },
    },
  });
}

export async function findUserKeyCollision(
  ctx: MutationCtx,
  uniqueId: string,
  email: string,
): Promise<"uniqueId" | "email" | null> {
  const existingUniqueId = await ctx.db
    .query("users")
    .withIndex("by_uniqueId", (q) => q.eq("uniqueId", uniqueId))
    .unique();
  if (existingUniqueId) return "uniqueId";

  const existingEmail = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  return existingEmail ? "email" : null;
}

export async function assertUniqueUserKeys(
  ctx: MutationCtx,
  uniqueId: string,
  email: string,
) {
  const collision = await findUserKeyCollision(ctx, uniqueId, email);
  if (collision === "uniqueId") throw new ConvexError("Unique ID already exists.");
  if (collision === "email") throw new ConvexError("Email already exists.");
}

export async function createLinkedUser(
  ctx: MutationCtx,
  args: CreateLinkedUserArgs,
  authApi?: Pick<ReturnType<typeof createAuth>["api"], "createUser">,
) {
  const uniqueId = normalizeUniqueId(args.uniqueId);
  const roles: AppRole[] = args.roles?.length ? args.roles : ["STUDENT"];
  const email = normalizeEmail(args.email ?? buildStudentEmail(uniqueId));
  const password = args.password ?? generateTemporaryPassword();
  const now = Date.now();

  assertInitialPasswordAllowed(password, uniqueId);

  await assertUniqueUserKeys(ctx, uniqueId, email);

  const authUser = await (authApi ?? createAuth(ctx).api).createUser({
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
    onboardingVersion: ONBOARDING_VERSION,
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
    use24HourTime: false,
    searchText: searchText({
      uniqueId,
      firstName: args.firstName,
      lastName: args.lastName,
    }),
    createdAt: now,
    updatedAt: now,
  });

  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError("Failed to create user.");
  }
  await incrementUserCounts(ctx, user, 1);

  return {
    user: toAdminUserProfile(user),
    temporaryPassword: args.password ? null : password,
  };
}

/**
 * Writes a role change in the order that keeps the stored flags, the user
 * counters and the Better Auth role consistent. Callers check permissions first.
 */
export async function applyRoleChange(
  ctx: MutationCtx,
  actor: Pick<Doc<"users">, "_id">,
  target: Doc<"users">,
  nextRoles: AppRole[],
) {
  const nextRoleFlags = classifyRoles(nextRoles);
  await ctx.db.patch(target._id, {
    roles: nextRoles,
    ...nextRoleFlags,
    updatedAt: Date.now(),
  });

  await replaceUserCounts(ctx, target, { ...target, ...nextRoleFlags });

  await syncBetterAuthRole(ctx, { ...target, roles: nextRoles });
  if (isPrivilegeReduction(target.roles, nextRoles)) {
    await revokeBetterAuthSessions(ctx, target.authUserId);
  }

  await logAuditEvent(ctx, {
    actorId: actor._id,
    action: "user.roles_assigned",
    entityType: "user",
    entityId: target._id,
    meta: { roles: nextRoles },
  });
}

/** Writes name fields together with `searchText`, which is derived from them. */
export async function writeUserNames(
  ctx: MutationCtx,
  user: Doc<"users">,
  names: Partial<Pick<Doc<"users">, "firstName" | "lastName" | "preferredName">>,
) {
  const updated = { ...user, ...names };
  await ctx.db.patch(user._id, {
    ...names,
    searchText: searchText(updated),
    updatedAt: Date.now(),
  });
  return updated;
}
