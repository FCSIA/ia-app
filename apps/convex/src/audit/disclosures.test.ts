/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema";

const modules = import.meta.glob("../**/*.*s");

async function insertAdmin(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      uniqueId: "admin-1",
      firstName: "Ada",
      lastName: "Admin",
      roles: ["SUPER_ADMIN"],
      isStudent: false,
      isTeacherStaff: true,
      isStudentAdmin: false,
      isOtherRole: false,
      isActive: true,
      mustResetPassword: false,
      dashboardLayout: [],
      searchText: "ada admin admin-1",
      createdAt: 1,
      updatedAt: 1,
    }),
  );
}

describe("FERPA disclosure records", () => {
  it("binds an internal export recipient to an app user", async () => {
    const t = convexTest(schema, modules);
    const adminId = await insertAdmin(t);

    const disclosureId = await t.run(async (ctx) =>
      ctx.db.insert("disclosureEvents", {
        actorId: adminId,
        action: "STUDENT_EXPORT",
        recordCategory: "student_directory_export",
        recipientType: "internal_school_official",
        recipientUserId: adminId,
        legalBasis: "FERPA school official / legitimate educational interest",
        legitimateInterest: "Student administration export requested from admin UI",
        meta: { rowCount: 3 },
        createdAt: 2,
      }),
    );

    const disclosure = await t.run((ctx) => ctx.db.get(disclosureId));
    expect(disclosure?.recipientUserId).toBe(adminId);
    expect(disclosure?.meta).toEqual({ rowCount: 3 });
  });

  it("rejects the former free-form recipient shape", async () => {
    const t = convexTest(schema, modules);
    const adminId = await insertAdmin(t);

    await expect(
      t.run(async (ctx) =>
        ctx.db.insert("disclosureEvents", {
          actorId: adminId,
          action: "STUDENT_EXPORT",
          recordCategory: "student_directory_export",
          recipientType: "internal_school_official",
          recipient: "IA admin CSV export",
          legalBasis: "FERPA school official / legitimate educational interest",
          legitimateInterest: "Student administration export requested from admin UI",
          meta: { rowCount: 3 },
          createdAt: 2,
        } as never),
      ),
    ).rejects.toThrow();
  });
});
