import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { logAuditEvent, logDisclosureEvent } from "../audit/_lib";
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
import {
  classifyRoles,
  createLinkedUser,
  createUserResultValidator,
  buildStudentEmail,
  generateTemporaryPassword,
  listUsersResultValidator,
  normalizeUniqueId,
  adminUserProfileValidator,
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

export const importStudents = mutation({
  args: {
    rows: v.array(studentImportRowValidator),
    generatePasswords: v.optional(v.boolean()),
  },
  returns: studentImportResultValidator,
  handler: async (ctx, args) => {
    const actor = await getCurrentAppUser(ctx);
    requireAnyRole(actor, ["SUPER_ADMIN"]);

    if (args.rows.length > 200) {
      throw new ConvexError("Import at most 200 students at a time.");
    }

    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
      generatedCredentials: [] as Array<{
        firstName: string;
        lastName: string;
        uniqueId: string;
        email: string;
        temporaryPassword: string;
      }>,
    };

    for (const [index, row] of args.rows.entries()) {
      try {
        const uniqueId = normalizeUniqueId(row.uniqueId);
        const firstName = row.firstName.trim();
        const lastName = row.lastName.trim();
        if (!uniqueId || !firstName || !lastName) {
          results.errors.push(`Row ${index + 2}: missing first name, last name, or student id`);
          results.skipped += 1;
          continue;
        }
        if (row.gradeLevel != null && (row.gradeLevel < 9 || row.gradeLevel > 12)) {
          throw new ConvexError(`Grade level must be between 9 and 12. Received "${row.gradeLevel}"`);
        }
        if (row.major && row.minor && row.major === row.minor) {
          throw new ConvexError("Minor pathway must be different from major pathway");
        }

        const existing = await ctx.db
          .query("users")
          .withIndex("by_uniqueId", (q) => q.eq("uniqueId", uniqueId))
          .unique();
        if (existing) {
          results.skipped += 1;
          continue;
        }

        const email = row.email?.trim() || buildStudentEmail(uniqueId);
        const temporaryPassword = generateTemporaryPassword();

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

        results.created += 1;
        results.generatedCredentials.push({
          firstName,
          lastName,
          uniqueId,
          email,
          temporaryPassword,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        results.errors.push(`Row ${index + 2}: ${message}`);
        results.skipped += 1;
      }
    }

    await logAuditEvent(ctx, {
      actorId: actor._id,
      action: "USER_CSV_IMPORT",
      entityType: "User",
      meta: {
        created: results.created,
        skipped: results.skipped,
        generatedPasswords: true,
      },
    });

    return results;
  },
});

export const exportStudents = mutation({
  args: {},
  returns: v.array(studentExportRowValidator),
  handler: async (ctx) => {
    const actor = await getCurrentAppUser(ctx);
    requireAnyRole(actor, ["SUPER_ADMIN"]);

    const students = await ctx.db
      .query("users")
      .withIndex("by_isStudent_and_lastName_and_firstName", (q) =>
        q.eq("isStudent", true),
      )
      .take(5000);

    const rows = students.map((student) => ({
      firstName: student.firstName,
      lastName: student.lastName,
      uniqueId: student.uniqueId,
      email: student.email ?? buildStudentEmail(student.uniqueId),
      gradeLevel: student.gradeLevel ?? null,
      major: student.major ?? null,
      minor: student.minor ?? null,
    }));

    await logAuditEvent(ctx, {
      actorId: actor._id,
      action: "USER_CSV_EXPORT",
      entityType: "User",
      meta: { rowCount: rows.length, roleGroup: "students" },
    });

    await logDisclosureEvent(ctx, {
      actorId: actor._id,
      action: "STUDENT_EXPORT",
      recordCategory: "student_directory_export",
      recipientType: "internal_school_official",
      recipient: "IA admin CSV export",
      legalBasis: "FERPA school official / legitimate educational interest",
      legitimateInterest: "Student administration export requested from admin UI",
      meta: { rowCount: rows.length },
    });

    return rows;
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
    return toAdminUserProfile(updated);
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
