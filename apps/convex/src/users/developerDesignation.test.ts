/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import schema from "../schema";
import { insertUser, userRow } from "../../test/fixtures";
import { toClubUserRef } from "../clubs/serialize";
import { serializeUser } from "../schedule/_lib";
import { toAdminUserProfile, toUserSelfProfile } from "./_lib";

const modules = import.meta.glob("/src/**/*.*s");

vi.mock("../../lib/currentUser", async (original) =>
  (await import("../../test/auth")).currentUserFromIdentity(await original()),
);

function makeUser(overrides: Partial<Doc<"users">> = {}): Doc<"users"> {
  return {
    _id: "users:dev" as Doc<"users">["_id"],
    _creationTime: 1_000,
    ...userRow({ uniqueId: "STU001", firstName: "Alex", lastName: "Johnson", ...overrides }),
  };
}

describe("developer designation", () => {
  it("rejects setDeveloper when the caller is not signed in", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) => insertUser(ctx, { uniqueId: "STU001" }));

    await expect(
      t.mutation(api.users.admin.setDeveloper, { userId, enabled: true }),
    ).rejects.toThrow("Unauthenticated");

    const stored = await t.run((ctx) => ctx.db.get(userId));
    expect(stored?.isDeveloper).toBeUndefined();
  });

  it("refuses to let a regular user grant themselves developer status", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) => insertUser(ctx, { uniqueId: "STU001" }));

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.users.admin.setDeveloper, {
        userId,
        enabled: true,
      }),
    ).rejects.toThrow("Forbidden");

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
