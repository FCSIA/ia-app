/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import schema from "../schema";
import { toClubUserRef } from "../clubs/serialize";
import { serializeUser } from "../schedule/_lib";
import { toAdminUserProfile, toUserSelfProfile } from "./_lib";

const modules = import.meta.glob("../**/*.*s");

function makeUser(overrides: Partial<Doc<"users">> = {}): Doc<"users"> {
  return {
    _id: "users:dev" as Doc<"users">["_id"],
    _creationTime: 1_000,
    uniqueId: "STU001",
    firstName: "Alex",
    lastName: "Johnson",
    roles: ["STUDENT"],
    isStudent: true,
    isTeacherStaff: false,
    isStudentAdmin: false,
    isOtherRole: false,
    isActive: true,
    mustResetPassword: false,
    dashboardLayout: [],
    searchText: "alex johnson stu001",
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

describe("developer designation", () => {
  it("rejects setDeveloper when the caller is not signed in", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", (({ _id: _ignored, _creationTime: _c, ...rest }) => rest)(makeUser())),
    );

    // Regular users cannot grant themselves developer status: the mutation
    // requires an authenticated SUPER_ADMIN actor before touching anything.
    await expect(
      t.mutation(api.users.admin.setDeveloper, { userId, enabled: true }),
    ).rejects.toThrow();

    const stored = await t.run((ctx) => ctx.db.get(userId));
    expect(stored?.isDeveloper).toBeUndefined();
  });

  it("carries isDeveloper through every shared identity projection", () => {
    const developer = makeUser({ isDeveloper: true });
    const regular = makeUser({ _id: "users:reg" as Doc<"users">["_id"] });

    // Club surfaces: chat authors, member lists, profile dialog.
    expect(toClubUserRef(developer).isDeveloper).toBe(true);
    expect(toClubUserRef(regular).isDeveloper).toBeUndefined();

    // Own profile + admin user list.
    expect(toUserSelfProfile(developer).isDeveloper).toBe(true);
    expect(toAdminUserProfile(developer).isDeveloper).toBe(true);
    expect(toAdminUserProfile(regular).isDeveloper).toBeUndefined();

    // Schedule friends / search results.
    expect(serializeUser(developer).isDeveloper).toBe(true);
  });
});
