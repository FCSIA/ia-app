/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { AppRole } from "../../../shared/roles";
import { MAX_CSV_ROWS } from "./_csvRows";
import schema from "../schema";
import { insertUser } from "../../test/fixtures";

vi.mock("../../lib/currentUser", async (original) =>
  (await import("../../test/auth")).currentUserFromIdentity(await original()),
);

const modules = import.meta.glob("/src/**/*.*s");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
    superId: await insertUser(ctx, { uniqueId: "SUPER", roles: ["SUPER_ADMIN"] }),
    adminId: await insertUser(ctx, { uniqueId: "ADMIN", roles: ["ADMIN"] }),
    otherAdminId: await insertUser(ctx, { uniqueId: "ADMIN2", roles: ["ADMIN"] }),
    studentId: await insertUser(ctx, { uniqueId: "STUDENT" }),
  }));
  const as = (id: Id<"users">) => t.withIdentity({ subject: id });
  return { t, ...ids, superAdmin: as(ids.superId), admin: as(ids.adminId) };
}

describe("assignRoles", () => {
  test("rewrites roles with the flags derived from them and audits the change", async () => {
    const { t, admin, adminId, studentId } = await fixture();

    const profile = await admin.mutation(api.users.admin.assignRoles, {
      userId: studentId,
      roles: ["TEACHER", "TEACHER"],
    });

    expect(profile.roles).toEqual(["TEACHER"]);
    await t.run(async (ctx) => {
      expect(await ctx.db.get(studentId)).toMatchObject({
        roles: ["TEACHER"],
        isStudent: false,
        isTeacherStaff: true,
      });
      const audit = await ctx.db.query("auditEvents").collect();
      expect(audit).toMatchObject([
        { action: "user.roles_assigned", actorId: adminId, entityId: studentId, meta: { roles: ["TEACHER"] } },
      ]);
    });
  });

  test("refuses an empty role list", async () => {
    const { admin, studentId } = await fixture();
    await expect(
      admin.mutation(api.users.admin.assignRoles, { userId: studentId, roles: [] }),
    ).rejects.toThrow("User must have at least one role.");
  });

  test("only a super admin may hand out admin roles", async () => {
    const { admin, superAdmin, t, studentId } = await fixture();

    await expect(
      admin.mutation(api.users.admin.assignRoles, { userId: studentId, roles: ["ADMIN"] }),
    ).rejects.toThrow("Only super admins can assign admin roles.");
    await superAdmin.mutation(api.users.admin.assignRoles, { userId: studentId, roles: ["ADMIN"] });

    expect((await t.run((ctx) => ctx.db.get(studentId)))?.roles).toEqual(["ADMIN"]);
  });

  test("nobody is promoted to super admin here", async () => {
    const { superAdmin, studentId } = await fixture();
    await expect(
      superAdmin.mutation(api.users.admin.assignRoles, { userId: studentId, roles: ["SUPER_ADMIN"] }),
    ).rejects.toThrow("Super-admin promotion requires an out-of-band process.");
  });

  test("an admin cannot act on an equal account, a super admin can act on an admin", async () => {
    const { admin, superAdmin, otherAdminId } = await fixture();
    await expect(
      admin.mutation(api.users.admin.assignRoles, { userId: otherAdminId, roles: ["STUDENT"] }),
    ).rejects.toThrow("You cannot act on an account with equal or greater privileges.");
    await superAdmin.mutation(api.users.admin.assignRoles, { userId: otherAdminId, roles: ["STUDENT"] });
  });

  test("at most five students hold the student admin role", async () => {
    const { t, admin, studentId } = await fixture();
    await t.run(async (ctx) => {
      for (let i = 0; i < 5; i++) {
        await insertUser(ctx, { uniqueId: `SA${i}`, roles: ["STUDENT_ADMIN" satisfies AppRole] });
      }
    });

    await expect(
      admin.mutation(api.users.admin.assignRoles, { userId: studentId, roles: ["STUDENT_ADMIN"] }),
    ).rejects.toThrow("Maximum of 5 students can have the Student Admin role.");
  });
});

describe("student CSV updates", () => {
  test("reports skipped rows by their CSV row number, headers counting as row 1", async () => {
    const { t, admin, adminId } = await fixture();
    await t.run((ctx) => insertUser(ctx, { uniqueId: "GRADE9", gradeLevel: 9 }));

    const result = await admin.action(api.users.admin.updateStudents, {
      rows: [
        { uniqueId: "grade9", gradeLevel: 10 },
        { uniqueId: "MISSING", gradeLevel: 11 },
        { uniqueId: "GRADE9", gradeLevel: 12 },
        { uniqueId: "GRADE9", gradeLevel: 99 },
      ],
    });

    expect(result).toEqual({
      updated: 1,
      skipped: 3,
      errors: [
        "Row 3: student ID 'MISSING' was not found",
        "Row 4: duplicate student ID 'GRADE9' in this CSV",
        "Row 5: duplicate student ID 'GRADE9' in this CSV",
      ],
    });
    await t.run(async (ctx) => {
      const student = await ctx.db.query("users").withIndex("by_uniqueId", (q) => q.eq("uniqueId", "GRADE9")).unique();
      expect(student?.gradeLevel).toBe(10);
      const audit = await ctx.db.query("auditEvents").collect();
      expect(audit).toMatchObject([
        { action: "USER_CSV_BULK_UPDATED", actorId: adminId, meta: { updated: 1, skipped: 3 } },
      ]);
    });
  });

  test("refuses an empty or oversized file with the limit in the message", async () => {
    const { admin } = await fixture();
    await expect(admin.action(api.users.admin.updateStudents, { rows: [] })).rejects.toThrow(
      "Import at least one student update.",
    );
    const rows = Array.from({ length: MAX_CSV_ROWS + 1 }, (_, i) => ({ uniqueId: `S${i}`, gradeLevel: 10 }));
    await expect(admin.action(api.users.admin.updateStudents, { rows })).rejects.toThrow(
      `Update at most ${MAX_CSV_ROWS} students at a time.`,
    );
  });

  test("only admins may import", async () => {
    const { t, studentId } = await fixture();
    await expect(
      t.withIdentity({ subject: studentId }).action(api.users.admin.updateStudents, {
        rows: [{ uniqueId: "X1", gradeLevel: 10 }],
      }),
    ).rejects.toThrow("Forbidden");
  });
});
