import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { logAuditEvent } from "../audit/_lib";
import {
  getCurrentAppUser,
  getMaybeCurrentAppUser,
  requireAnyRole,
  requireAnyRoleSafe,
} from "../../lib/currentUser";
import { USER_MANAGEMENT_ROLES } from "../../lib/roles";
import {
  appRoleValidator,
  pathwayValidator,
} from "../validators";
import {
  authComponent,
  createAuth,
} from "../auth";
import { getStoredUserCount, incrementUserCounts, replaceUserCounts } from "../stats";
import {
  classifyRoles,
  createLinkedUser,
  createUserResultValidator,
  buildStudentEmail,
  generateTemporaryPassword,
  listUsersResultValidator,
  normalizeUniqueId,
  adminUserProfileValidator,
  assertCanActOn,
  assertCanResetPassword,
  betterAuthRoleForAppRoles,
  isPrivilegeReduction,
  revokeBetterAuthSessions,
  searchText,
  setBetterAuthPassword,
  syncBetterAuthRole,
  isStudentUser,
  administratorImportResultValidator,
  studentExportRowValidator,
  studentImportResultValidator,
  toAdminUserProfile,
  userRoleGroupValidator,
  type Pathway,
} from "./_lib";

const studentImportRowValidator = v.object({
  uniqueId: v.string(),
  firstName: v.string(),
  lastName: v.string(),
  gradeLevel: v.optional(v.number()),
  major: v.optional(pathwayValidator),
  minor: v.optional(pathwayValidator),
  email: v.optional(v.string()),
});

const studentBulkUpdateRowValidator = v.object({
  uniqueId: v.string(),
  gradeLevel: v.optional(v.union(v.number(), v.null())),
  major: v.optional(v.union(pathwayValidator, v.null())),
  minor: v.optional(v.union(pathwayValidator, v.null())),
});

const administratorImportRowValidator = v.object({
  uniqueId: v.string(),
  firstName: v.string(),
  lastName: v.string(),
  email: v.string(),
});

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    roleGroup: v.optional(userRoleGroupValidator),
  },
  returns: listUsersResultValidator,
  handler: async (ctx, args) => {
    const actor = await getMaybeCurrentAppUser(ctx);
    if (!actor || !requireAnyRoleSafe(actor, [...USER_MANAGEMENT_ROLES, "SUPPORT_STAFF"])) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }

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
      page: page.page.map(toAdminUserProfile),
    };
  },
});

export const count = query({
  args: {
    roleGroup: v.optional(userRoleGroupValidator),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const actor = await getMaybeCurrentAppUser(ctx);
    if (!actor || !requireAnyRoleSafe(actor, [...USER_MANAGEMENT_ROLES, "SUPPORT_STAFF"])) {
      return 0;
    }

    const roleGroup = args.roleGroup ?? "all";

    const storedCount = await getStoredUserCount(ctx, roleGroup);
    if (storedCount !== null) return storedCount;

    // Old deployments do not have the newer role-group counters yet. Keep the
    // count exact until `internal.stats.rebuildUserCounts` runs once.
    const users =
      roleGroup === "students"
        ? await ctx.db
            .query("users")
            .withIndex("by_isStudent_and_lastName_and_firstName", (q) =>
              q.eq("isStudent", true),
            )
            .take(10000)
        : roleGroup === "teachers"
          ? await ctx.db
              .query("users")
              .withIndex("by_isTeacherStaff_and_lastName_and_firstName", (q) =>
                q.eq("isTeacherStaff", true),
              )
              .take(10000)
          : roleGroup === "student-admin"
            ? await ctx.db
                .query("users")
                .withIndex(
                  "by_isStudentAdmin_and_lastName_and_firstName",
                  (q) => q.eq("isStudentAdmin", true),
                )
                .take(10000)
            : roleGroup === "other"
              ? await ctx.db
                  .query("users")
                  .withIndex("by_isOtherRole_and_lastName_and_firstName", (q) =>
                    q.eq("isOtherRole", true),
                  )
                  .take(10000)
              : await ctx.db
                  .query("users")
                  .withIndex("by_lastName_and_firstName")
                  .take(10000);

    return users.length;
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
      entityId: result.user._id,
      meta: { roles: requestedRoles },
    });

    return result;
  },
});

const generatedCredentialValidator = v.object({
  firstName: v.string(),
  lastName: v.string(),
  uniqueId: v.string(),
  email: v.string(),
  temporaryPassword: v.string(),
});

type GeneratedCredential = {
  firstName: string;
  lastName: string;
  uniqueId: string;
  email: string;
  temporaryPassword: string;
};

type StudentImportRowResult =
  | {
      kind: "created";
      credential?: GeneratedCredential;
    }
  | {
      kind: "skipped";
      error?: string;
    };

type StudentImportResult = {
  created: number;
  skipped: number;
  errors: string[];
  generatedCredentials: GeneratedCredential[];
};

const studentImportRowResultValidator = v.union(
  v.object({
    kind: v.literal("created"),
    credential: v.optional(generatedCredentialValidator),
  }),
  v.object({
    kind: v.literal("skipped"),
    error: v.optional(v.string()),
  }),
);

type StudentBulkUpdateRowResult =
  | { kind: "updated" }
  | { kind: "skipped"; error?: string };

type StudentBulkUpdateResult = {
  updated: number;
  skipped: number;
  errors: string[];
};

const studentBulkUpdateRowResultValidator = v.union(
  v.object({ kind: v.literal("updated") }),
  v.object({ kind: v.literal("skipped"), error: v.optional(v.string()) }),
);

const studentBulkUpdateResultValidator = v.object({
  updated: v.number(),
  skipped: v.number(),
  errors: v.array(v.string()),
});

const STUDENT_IMPORT_BATCH_SIZE = 5;
const ADMINISTRATOR_IMPORT_BATCH_SIZE = 5;

export const requireStudentImportActor = internalQuery({
  args: {},
  returns: v.id("users"),
  handler: async (ctx): Promise<Id<"users">> => {
    const actor = await getCurrentAppUser(ctx);
    requireAnyRole(actor, [...USER_MANAGEMENT_ROLES]);
    return actor._id;
  },
});

export const importStudentRow = internalMutation({
  args: {
    row: studentImportRowValidator,
  },
  returns: studentImportRowResultValidator,
  handler: async (ctx, args): Promise<StudentImportRowResult> => {
    const { row } = args;
    const uniqueId = normalizeUniqueId(row.uniqueId);
    const firstName = row.firstName.trim();
    const lastName = row.lastName.trim();

    const skip = (error?: string): StudentImportRowResult => ({
      kind: "skipped",
      ...(error === undefined ? {} : { error }),
    });

    if (!uniqueId || !firstName || !lastName) {
      return skip("missing first name, last name, or student id");
    }
    if (uniqueId.length < 3) {
      return skip(
        `Student ID '${uniqueId}' is too short. It must be at least 3 characters.`,
      );
    }
    if (
      row.gradeLevel != null &&
      (row.gradeLevel < 9 || row.gradeLevel > 12)
    ) {
      return skip(
        `Grade level must be between 9 and 12. Received "${row.gradeLevel}"`,
      );
    }
    if (row.major && row.minor && row.major === row.minor) {
      return skip("Minor pathway must be different from major pathway");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_uniqueId", (q) => q.eq("uniqueId", uniqueId))
      .unique();

    if (existing) {
      return skip();
    }

    const email = row.email?.trim() || buildStudentEmail(uniqueId);
    const temporaryPassword = generateTemporaryPassword();

    // Let failures escape so this student's entire transaction rolls back.
    await createLinkedUser(ctx, {
      uniqueId,
      firstName,
      lastName,
      gradeLevel: row.gradeLevel,
      major: row.major as Pathway | undefined,
      minor: row.minor as Pathway | undefined,
      email,
      password: temporaryPassword,
      roles: ["STUDENT"],
    });

    return {
      kind: "created",
      credential: {
        firstName,
        lastName,
        uniqueId,
        email,
        temporaryPassword,
      },
    };
  },
});

export const updateStudentRow = internalMutation({
  args: {
    row: studentBulkUpdateRowValidator,
  },
  returns: studentBulkUpdateRowResultValidator,
  handler: async (ctx, args): Promise<StudentBulkUpdateRowResult> => {
    const uniqueId = normalizeUniqueId(args.row.uniqueId);
    const skip = (error?: string): StudentBulkUpdateRowResult => ({
      kind: "skipped",
      ...(error === undefined ? {} : { error }),
    });

    if (!uniqueId) return skip("missing student ID");
    if (
      args.row.gradeLevel === undefined &&
      args.row.major === undefined &&
      args.row.minor === undefined
    ) {
      return skip("no fields to update");
    }
    if (
      args.row.gradeLevel !== undefined &&
      args.row.gradeLevel !== null &&
      (args.row.gradeLevel < 9 || args.row.gradeLevel > 12)
    ) {
      return skip("grade level must be between 9 and 12");
    }

    const student = await ctx.db
      .query("users")
      .withIndex("by_uniqueId", (q) => q.eq("uniqueId", uniqueId))
      .unique();
    if (!student || !student.isStudent) return skip(`student ID '${uniqueId}' was not found`);

    const major = args.row.major === undefined ? student.major : args.row.major ?? undefined;
    const minor = args.row.minor === undefined ? student.minor : args.row.minor ?? undefined;
    if (major && minor && major === minor) {
      return skip("minor pathway must be different from major pathway");
    }

    const updates: {
      gradeLevel?: number;
      major?: Pathway;
      minor?: Pathway;
      updatedAt: number;
    } = { updatedAt: Date.now() };
    if (args.row.gradeLevel !== undefined) updates.gradeLevel = args.row.gradeLevel ?? undefined;
    if (args.row.major !== undefined) updates.major = args.row.major ?? undefined;
    if (args.row.minor !== undefined) updates.minor = args.row.minor ?? undefined;
    await ctx.db.patch(student._id, updates);

    return { kind: "updated" };
  },
});

export const logStudentImportAudit = internalMutation({
  args: {
    actorId: v.id("users"),
    created: v.number(),
    skipped: v.number(),
    generatedPasswords: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await logAuditEvent(ctx, {
      actorId: args.actorId,
      action: "USER_CSV_IMPORT",
      entityType: "User",
      meta: {
        created: args.created,
        skipped: args.skipped,
        generatedPasswords: args.generatedPasswords,
      },
    });
    return null;
  },
});

export const logStudentBulkUpdateAudit = internalMutation({
  args: {
    actorId: v.id("users"),
    updated: v.number(),
    skipped: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await logAuditEvent(ctx, {
      actorId: args.actorId,
      action: "USER_CSV_BULK_UPDATED",
      entityType: "User",
      entityId: "bulk",
      meta: { updated: args.updated, skipped: args.skipped },
    });
    return null;
  },
});

export const importStudents = action({
  args: {
    rows: v.array(studentImportRowValidator),
  },
  returns: studentImportResultValidator,
  handler: async (ctx, args): Promise<StudentImportResult> => {
    const actorId: Id<"users"> = await ctx.runQuery(
      internal.users.admin.requireStudentImportActor,
      {},
    );

    if (args.rows.length === 0) {
      throw new ConvexError("Import at least one student.");
    }
    if (args.rows.length > 200) {
      throw new ConvexError("Import at most 200 students at a time.");
    }

    const results: StudentImportResult = {
      created: 0,
      skipped: 0,
      errors: [],
      generatedCredentials: [],
    };

    const seenUniqueIds = new Set<string>();
    const work = args.rows.map((row, index) => {
      const uniqueId = normalizeUniqueId(row.uniqueId);
      const duplicateWithinImport =
        uniqueId.length > 0 && seenUniqueIds.has(uniqueId);

      if (uniqueId.length > 0) {
        seenUniqueIds.add(uniqueId);
      }

      return {
        row,
        rowNumber: index + 2,
        uniqueId,
        duplicateWithinImport,
      };
    });

    for (let start = 0; start < work.length; start += STUDENT_IMPORT_BATCH_SIZE) {
      const batch = work.slice(start, start + STUDENT_IMPORT_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (entry): Promise<StudentImportRowResult> => {
          if (entry.duplicateWithinImport) {
            return {
              kind: "skipped",
              error: `Duplicate student ID '${entry.uniqueId}' in this CSV.`,
            };
          }

          try {
            return await ctx.runMutation(
              internal.users.admin.importStudentRow,
              {
                row: entry.row,
              },
            );
          } catch (error) {
            return {
              kind: "skipped",
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        }),
      );

      for (const [batchIndex, result] of batchResults.entries()) {
        const rowNumber = batch[batchIndex]!.rowNumber;

        if (result.kind === "created") {
          results.created += 1;
          if (result.credential) {
            results.generatedCredentials.push(result.credential);
          }
        } else {
          results.skipped += 1;
          if (result.error) {
            results.errors.push(`Row ${rowNumber}: ${result.error}`);
          }
        }
      }
    }

    try {
      await ctx.runMutation(internal.users.admin.logStudentImportAudit, {
        actorId,
        created: results.created,
        skipped: results.skipped,
        generatedPasswords: true,
      });
    } catch (error) {
      console.error("Failed to record student import audit event", error);
    }

    return results;
  },
});

export const updateStudents = action({
  args: {
    rows: v.array(studentBulkUpdateRowValidator),
  },
  returns: studentBulkUpdateResultValidator,
  handler: async (ctx, args): Promise<StudentBulkUpdateResult> => {
    const actorId: Id<"users"> = await ctx.runQuery(
      internal.users.admin.requireStudentImportActor,
      {},
    );
    if (args.rows.length === 0) throw new ConvexError("Import at least one student update.");
    if (args.rows.length > 200) throw new ConvexError("Update at most 200 students at a time.");

    const results: StudentBulkUpdateResult = { updated: 0, skipped: 0, errors: [] };
    const seenUniqueIds = new Set<string>();
    const work = args.rows.map((row, index) => {
      const uniqueId = normalizeUniqueId(row.uniqueId);
      const duplicateWithinImport = uniqueId.length > 0 && seenUniqueIds.has(uniqueId);
      if (uniqueId.length > 0) seenUniqueIds.add(uniqueId);
      return { row, rowNumber: index + 2, uniqueId, duplicateWithinImport };
    });

    for (let start = 0; start < work.length; start += STUDENT_IMPORT_BATCH_SIZE) {
      const batch = work.slice(start, start + STUDENT_IMPORT_BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(async (entry): Promise<StudentBulkUpdateRowResult> => {
        if (entry.duplicateWithinImport) {
          return { kind: "skipped", error: `duplicate student ID '${entry.uniqueId}' in this CSV` };
        }
        try {
          return await ctx.runMutation(internal.users.admin.updateStudentRow, { row: entry.row });
        } catch (error) {
          return { kind: "skipped", error: error instanceof Error ? error.message : "Unknown error" };
        }
      }));

      for (const [batchIndex, result] of batchResults.entries()) {
        if (result.kind === "updated") {
          results.updated += 1;
        } else {
          results.skipped += 1;
          if (result.error) results.errors.push(`Row ${batch[batchIndex]!.rowNumber}: ${result.error}`);
        }
      }
    }

    try {
      await ctx.runMutation(internal.users.admin.logStudentBulkUpdateAudit, {
        actorId,
        updated: results.updated,
        skipped: results.skipped,
      });
    } catch (error) {
      console.error("Failed to record student bulk update audit event", error);
    }
    return results;
  },
});

type AdministratorImportRowResult =
  | {
      kind: "created";
      credential?: GeneratedCredential;
    }
  | {
      kind: "skipped";
      error?: string;
    };

type AdministratorImportResult = {
  created: number;
  skipped: number;
  errors: string[];
  generatedCredentials: GeneratedCredential[];
};

const administratorImportRowResultValidator = v.union(
  v.object({
    kind: v.literal("created"),
    credential: v.optional(generatedCredentialValidator),
  }),
  v.object({
    kind: v.literal("skipped"),
    error: v.optional(v.string()),
  }),
);

export const requireAdministratorImportActor = internalQuery({
  args: {},
  returns: v.id("users"),
  handler: async (ctx): Promise<Id<"users">> => {
    const actor = await getCurrentAppUser(ctx);
    requireAnyRole(actor, ["SUPER_ADMIN"]);
    return actor._id;
  },
});

export const importAdministratorRow = internalMutation({
  args: {
    row: administratorImportRowValidator,
  },
  returns: administratorImportRowResultValidator,
  handler: async (ctx, args): Promise<AdministratorImportRowResult> => {
    const uniqueId = normalizeUniqueId(args.row.uniqueId);
    const firstName = args.row.firstName.trim();
    const lastName = args.row.lastName.trim();
    const email = args.row.email.trim();

    const skip = (error?: string): AdministratorImportRowResult => ({
      kind: "skipped",
      ...(error === undefined ? {} : { error }),
    });

    if (!uniqueId || !firstName || !lastName || !email) {
      return skip("missing first name, last name, administrator ID, or email");
    }
    if (uniqueId.length < 3) {
      return skip(
        `Administrator ID '${uniqueId}' is too short. It must be at least 3 characters.`,
      );
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_uniqueId", (q) => q.eq("uniqueId", uniqueId))
      .unique();
    if (existing) return skip();

    const temporaryPassword = generateTemporaryPassword();
    await createLinkedUser(ctx, {
      uniqueId,
      firstName,
      lastName,
      email,
      password: temporaryPassword,
      roles: ["ADMIN"],
    });

    return {
      kind: "created",
      credential: {
        firstName,
        lastName,
        uniqueId,
        email,
        temporaryPassword,
      },
    };
  },
});

export const logAdministratorImportAudit = internalMutation({
  args: {
    actorId: v.id("users"),
    created: v.number(),
    skipped: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await logAuditEvent(ctx, {
      actorId: args.actorId,
      action: "ADMINISTRATOR_CSV_IMPORT",
      entityType: "User",
      meta: {
        created: args.created,
        skipped: args.skipped,
        generatedPasswords: true,
      },
    });
    return null;
  },
});

export const importAdministrators = action({
  args: {
    rows: v.array(administratorImportRowValidator),
  },
  returns: administratorImportResultValidator,
  handler: async (ctx, args): Promise<AdministratorImportResult> => {
    const actorId: Id<"users"> = await ctx.runQuery(
      internal.users.admin.requireAdministratorImportActor,
      {},
    );

    if (args.rows.length === 0) {
      throw new ConvexError("Import at least one administrator.");
    }
    if (args.rows.length > 200) {
      throw new ConvexError("Import at most 200 administrators at a time.");
    }

    const results: AdministratorImportResult = {
      created: 0,
      skipped: 0,
      errors: [],
      generatedCredentials: [],
    };
    const seenUniqueIds = new Set<string>();
    const work = args.rows.map((row, index) => {
      const uniqueId = normalizeUniqueId(row.uniqueId);
      const duplicateWithinImport =
        uniqueId.length > 0 && seenUniqueIds.has(uniqueId);
      if (uniqueId.length > 0) seenUniqueIds.add(uniqueId);

      return {
        row,
        rowNumber: index + 2,
        uniqueId,
        duplicateWithinImport,
      };
    });

    for (
      let start = 0;
      start < work.length;
      start += ADMINISTRATOR_IMPORT_BATCH_SIZE
    ) {
      const batch = work.slice(start, start + ADMINISTRATOR_IMPORT_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (entry): Promise<AdministratorImportRowResult> => {
          if (entry.duplicateWithinImport) {
            return {
              kind: "skipped",
              error: `Duplicate administrator ID '${entry.uniqueId}' in this CSV.`,
            };
          }

          try {
            return await ctx.runMutation(
              internal.users.admin.importAdministratorRow,
              { row: entry.row },
            );
          } catch (error) {
            return {
              kind: "skipped",
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        }),
      );

      for (const [batchIndex, result] of batchResults.entries()) {
        const rowNumber = batch[batchIndex]!.rowNumber;
        if (result.kind === "created") {
          results.created += 1;
          if (result.credential) results.generatedCredentials.push(result.credential);
        } else {
          results.skipped += 1;
          if (result.error) results.errors.push(`Row ${rowNumber}: ${result.error}`);
        }
      }
    }

    try {
      await ctx.runMutation(internal.users.admin.logAdministratorImportAudit, {
        actorId,
        created: results.created,
        skipped: results.skipped,
      });
    } catch (error) {
      console.error("Failed to record administrator import audit event", error);
    }

    return results;
  },
});

export const exportStudents = query({
  args: {},
  returns: v.array(studentExportRowValidator),
  handler: async (ctx) => {
    const actor = await getMaybeCurrentAppUser(ctx);
    if (!actor || !requireAnyRoleSafe(actor, ["SUPER_ADMIN"])) return [];

    const students = await ctx.db
      .query("users")
      .withIndex("by_isStudent_and_lastName_and_firstName", (q) =>
        q.eq("isStudent", true),
      )
      .take(5000);

    return students.map((student) => ({
      firstName: student.firstName,
      lastName: student.lastName,
      uniqueId: student.uniqueId,
      email: student.email ?? buildStudentEmail(student.uniqueId),
      gradeLevel: student.gradeLevel ?? null,
      major: student.major ?? null,
      minor: student.minor ?? null,
    }));
  },
});

export const setFeedbackReviewer = mutation({
  args: {
    userId: v.id("users"),
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await getCurrentAppUser(ctx);
    requireAnyRole(actor, ["SUPER_ADMIN"]);

    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError("User not found.");
    if (!isStudentUser(target)) {
      throw new ConvexError("Feedback review access is reserved for student developers.");
    }

    await ctx.db.patch(target._id, {
      canReviewFeedback: args.enabled,
      updatedAt: Date.now(),
    });
    await logAuditEvent(ctx, {
      actorId: actor._id,
      action: "USER_FEEDBACK_REVIEW_ACCESS_UPDATED",
      entityType: "User",
      entityId: target._id,
      meta: { enabled: args.enabled },
    });

    return null;
  },
});

export const activate = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: adminUserProfileValidator,
  handler: async (ctx, args) => {
    const actor = await getCurrentAppUser(ctx);
    requireAnyRole(actor, [...USER_MANAGEMENT_ROLES]);

    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError("User not found.");
    }
    assertCanActOn(actor, target);

    if (!target.authUserId) {
      throw new ConvexError("User is not linked to an auth account.");
    }

    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    await auth.api.unbanUser({
      body: { userId: target.authUserId },
      headers,
    });

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
    return toAdminUserProfile(updated);
  },
});

export const deactivate = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: adminUserProfileValidator,
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
    assertCanActOn(actor, target);

    if (!target.authUserId) {
      throw new ConvexError("User is not linked to an auth account.");
    }

    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    await auth.api.banUser({
      body: {
        userId: target.authUserId,
        banReason: "Account deactivated in Innovation Academy",
      },
      headers,
    });
    await revokeBetterAuthSessions(ctx, target.authUserId);

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
    return toAdminUserProfile(updated);
  },
});

const MAX_BULK_USER_DELETION_SIZE = 30;

export const deleteUsers = mutation({
  args: {
    userIds: v.array(v.id("users")),
  },
  returns: v.object({
    deleted: v.number(),
  }),
  handler: async (ctx, args) => {
    const actor = await getCurrentAppUser(ctx);
    requireAnyRole(actor, ["SUPER_ADMIN"]);

    const userIds = Array.from(new Set(args.userIds));
    if (userIds.length === 0) {
      throw new ConvexError("Select at least one user to delete.");
    }
    if (userIds.length > MAX_BULK_USER_DELETION_SIZE) {
      throw new ConvexError(
        `Delete at most ${MAX_BULK_USER_DELETION_SIZE} users at a time.`,
      );
    }
    if (userIds.includes(actor._id)) {
      throw new ConvexError("You cannot delete your own account.");
    }

    const targets = await Promise.all(userIds.map((userId) => ctx.db.get(userId)));
    if (targets.some((target) => !target)) {
      throw new ConvexError("One or more selected users no longer exist.");
    }

    for (const target of targets) {
      if (!target) continue;
      assertCanActOn(actor, target);

      if (target.authUserId) {
        const maintenanceSecret = process.env.BETTER_AUTH_MAINTENANCE_SECRET;
        if (!maintenanceSecret) throw new ConvexError("Auth maintenance is not configured.");
        await ctx.runMutation(components.betterAuth.dev.deleteUserData, {
          userId: target.authUserId,
          maintenanceSecret,
        });
      }
      if (target.avatarStorageId) {
        await ctx.storage.delete(target.avatarStorageId);
      }
      if (target.customBackgroundStorageId) {
        await ctx.storage.delete(target.customBackgroundStorageId);
      }

      await ctx.db.delete(target._id);
      await incrementUserCounts(ctx, target, -1);
    }

    await logAuditEvent(ctx, {
      actorId: actor._id,
      action: "user.bulk_deleted",
      entityType: "user",
      entityId: "bulk",
      meta: {
        count: targets.length,
        userIds: targets.map((target) => target!._id),
      },
    });

    return { deleted: targets.length };
  },
});

export const assignRoles = mutation({
  args: {
    userId: v.id("users"),
    roles: v.array(appRoleValidator),
  },
  returns: adminUserProfileValidator,
  handler: async (ctx, args) => {
    const actor = await getCurrentAppUser(ctx);
    requireAnyRole(actor, [...USER_MANAGEMENT_ROLES]);

    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError("User not found.");
    }
    assertCanActOn(actor, target);

    const nextRoles = Array.from(new Set(args.roles));
    if (nextRoles.length === 0) {
      throw new ConvexError("User must have at least one role.");
    }

    if (
      nextRoles.some((role) => ["ADMIN", "SUPER_ADMIN"].includes(role)) &&
      !actor.roles.includes("SUPER_ADMIN")
    ) {
      throw new ConvexError("Only super admins can assign admin roles.");
    }
    if (
      nextRoles.includes("SUPER_ADMIN") &&
      !target.roles.includes("SUPER_ADMIN")
    ) {
      throw new ConvexError("Super-admin promotion requires an out-of-band process.");
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

    // Check for STUDENT_ADMIN limit (max 5)
    const isAddingStudentAdmin = nextRoles.includes("STUDENT_ADMIN");
    const alreadyIsStudentAdmin = target.roles.includes("STUDENT_ADMIN");

    if (isAddingStudentAdmin && !alreadyIsStudentAdmin) {
      const currentStudentAdmins = await ctx.db
        .query("users")
        .withIndex("by_isStudentAdmin_and_lastName_and_firstName", (q) =>
          q.eq("isStudentAdmin", true),
        )
        .take(5);
      if (currentStudentAdmins.length >= 5) {
        throw new ConvexError(
          "Maximum of 5 students can have the Student Admin role.",
        );
      }
    }

    const nextRoleFlags = classifyRoles(nextRoles as any);
    await ctx.db.patch(target._id, {
      roles: nextRoles as any,
      ...nextRoleFlags,
      updatedAt: Date.now(),
    });

    await replaceUserCounts(ctx, target, { ...target, ...nextRoleFlags });

    const updatedRolesTarget = { ...target, roles: nextRoles as any };
    await syncBetterAuthRole(ctx, updatedRolesTarget);
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

    const updated = await ctx.db.get(target._id);
    if (!updated) {
      throw new ConvexError("User not found.");
    }
    return toAdminUserProfile(updated);
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
    assertCanResetPassword(actor, target);

    if (!target.authUserId) {
      throw new ConvexError("User is not linked to an auth account.");
    }

    const temporaryPassword = generateTemporaryPassword();
    await setBetterAuthPassword(ctx, target.authUserId, temporaryPassword);
    await revokeBetterAuthSessions(ctx, target.authUserId);

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

export const reconcileBetterAuthRoles = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    repaired: v.number(),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("users").paginate({
      numItems: 25,
      cursor: args.cursor ?? null,
    });

    let repaired = 0;
    for (const user of page.page) {
      if (!user.authUserId) continue;
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "user",
          where: [{ field: "_id", value: user.authUserId }],
          update: { role: betterAuthRoleForAppRoles(user.roles) },
        },
      });
      repaired += 1;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.users.admin.reconcileBetterAuthRoles,
        { cursor: page.continueCursor },
      );
    }

    return {
      repaired,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const rotateAllCredentialAccountsBatch = internalMutation({
  args: {
    acknowledgeBulkSignOut: v.literal(true),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    credentials: v.array(
      v.object({
        userId: v.id("users"),
        uniqueId: v.string(),
        temporaryPassword: v.string(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("users").paginate({
      numItems: 10,
      cursor: args.cursor ?? null,
    });
    const credentials = [];

    for (const user of page.page) {
      if (!user.authUserId) continue;
      const credentialAccount = await ctx.runQuery(
        components.betterAuth.adapter.findOne,
        {
          model: "account",
          where: [
            { field: "userId", value: user.authUserId },
            { field: "providerId", value: "credential" },
          ],
        },
      );
      if (!credentialAccount) continue;

      const temporaryPassword = generateTemporaryPassword();
      await setBetterAuthPassword(ctx, user.authUserId, temporaryPassword);
      await revokeBetterAuthSessions(ctx, user.authUserId);
      await ctx.db.patch(user._id, {
        mustResetPassword: true,
        updatedAt: Date.now(),
      });
      await logAuditEvent(ctx, {
        action: "user.legacy_credential_rotated",
        entityType: "user",
        entityId: user._id,
      });
      credentials.push({
        userId: user._id,
        uniqueId: user.uniqueId,
        temporaryPassword,
      });
    }

    return {
      credentials,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const rebuildPrivateUserSearchIndex = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({ updated: v.number(), isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("users").paginate({ numItems: 100, cursor: args.cursor ?? null });
    for (const user of page.page) {
      await ctx.db.patch(user._id, { searchText: searchText({ uniqueId: user.uniqueId, firstName: user.firstName, lastName: user.lastName }), updatedAt: Date.now() });
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.users.admin.rebuildPrivateUserSearchIndex, { cursor: page.continueCursor });
    return { updated: page.page.length, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});
