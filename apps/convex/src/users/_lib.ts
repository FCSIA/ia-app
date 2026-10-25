import { ConvexError, v, type Infer } from "convex/values";
import { hashPassword } from "better-auth/crypto";
import { createAuth } from "../auth";
import { components } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { type AppRole } from "../../lib/roles";
import { incrementUserCounts } from "../stats";
import { schema } from "../schema";

const userProfileValidator = schema
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

export const userSelfProfileValidator = userProfileValidator.extend(
  schema
    .doc("users")
    .pick(
      "mustResetPassword",
      "canReviewFeedback",
      "dashboardLayout",
      "dashboardColumns",
      "mobileTabLayout",
      "use24HourTime",
      "chatDoubleTapReaction",
      "customBackgroundUrl",
      "customBackgroundPalette",
      "customBackgroundTint",
      "customBackgroundBlur",
    ).fields,
);

export const adminUserProfileValidator = userProfileValidator;

export function toUserSelfProfile(user: Doc<"users">) {
  return {
    _id: user._id,
    uniqueId: user.uniqueId,
    firstName: user.firstName,
    lastName: user.lastName,
    preferredName: user.preferredName,
    roles: user.roles,
    gradeLevel: user.gradeLevel,
    major: user.major,
    minor: user.minor,
    email: user.email,
    isActive: user.isActive,
    mustResetPassword: user.mustResetPassword,
    canReviewFeedback: user.canReviewFeedback,
    dashboardLayout: user.dashboardLayout,
    dashboardColumns: user.dashboardColumns,
    mobileTabLayout: user.mobileTabLayout,
    use24HourTime: user.use24HourTime ?? false,
    chatDoubleTapReaction: user.chatDoubleTapReaction,
    avatarUrl: user.avatarUrl,
    customBackgroundUrl: user.customBackgroundUrl,
    customBackgroundPalette: user.customBackgroundPalette,
    customBackgroundTint: user.customBackgroundTint,
    customBackgroundBlur: user.customBackgroundBlur,
    isDeveloper: user.isDeveloper,
    approvedBugCount: user.approvedBugCount,
    bugTagColor: user.bugTagColor,
  } satisfies Infer<typeof userSelfProfileValidator>;
}

export function toAdminUserProfile(user: Doc<"users">) {
  return {
    _id: user._id,
    uniqueId: user.uniqueId,
    firstName: user.firstName,
    lastName: user.lastName,
    preferredName: user.preferredName,
    roles: user.roles,
    gradeLevel: user.gradeLevel,
    major: user.major,
    minor: user.minor,
    email: user.email,
    isActive: user.isActive,
    avatarUrl: user.avatarUrl,
    isDeveloper: user.isDeveloper,
    approvedBugCount: user.approvedBugCount,
    bugTagColor: user.bugTagColor,
  } satisfies Infer<typeof adminUserProfileValidator>;
}

export const temporaryPasswordAlphabet =
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

export const listUsersResultValidator = v.object({
  page: v.array(adminUserProfileValidator),
  isDone: v.boolean(),
  continueCursor: v.string(),
  pageStatus: v.optional(
    v.union(
      v.literal("SplitRecommended"),
      v.literal("SplitRequired"),
      v.null(),
    ),
  ),
  splitCursor: v.optional(v.union(v.string(), v.null())),
});

export const studentImportResultValidator = v.object({
  created: v.number(),
  skipped: v.number(),
  errors: v.array(v.string()),
  generatedCredentials: v.array(
    v.object({
      firstName: v.string(),
      lastName: v.string(),
      uniqueId: v.string(),
      email: v.string(),
      temporaryPassword: v.string(),
    }),
  ),
});

// Administrator imports return the same one-time credential envelope as the
// student roster import. Keeping one validator ensures the two operator flows
// expose the same bounded result without persisting passwords in application
// data or audit events.
export const administratorImportResultValidator = studentImportResultValidator;

export const studentExportRowValidator = v.object({
  firstName: v.string(),
  lastName: v.string(),
  uniqueId: v.string(),
  email: v.string(),
  gradeLevel: v.union(v.number(), v.null()),
  major: v.union(v.string(), v.null()),
  minor: v.union(v.string(), v.null()),
});

export type Pathway =
  "INFORMATION_TECHNOLOGY" | "HEALTH_SCIENCE" | "ENGINEERING";

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
    isOtherRole:
      !isStudent && !isTeacherStaff && !isStudentAdmin && isPrivileged,
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
  if (password.length < 6) {
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
    !target.roles.some((role) =>
      ["STUDENT", "STUDENT_LEADER", "STUDENT_ADMIN"].includes(role),
    )
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

export async function createLinkedUser(
  ctx: MutationCtx,
  args: CreateLinkedUserArgs,
) {
  const uniqueId = normalizeUniqueId(args.uniqueId);
  const roles: AppRole[] = args.roles?.length ? args.roles : ["STUDENT"];
  const email = normalizeEmail(args.email ?? buildStudentEmail(uniqueId));
  const password = args.password ?? generateTemporaryPassword();
  const now = Date.now();

  assertInitialPasswordAllowed(password, uniqueId);

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

export function isStudentUser(user: Doc<"users">) {
  return user.roles.some((role) =>
    ["STUDENT", "STUDENT_LEADER", "STUDENT_ADMIN"].includes(role),
  );
}
