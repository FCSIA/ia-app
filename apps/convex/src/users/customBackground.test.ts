/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";
import { MAX_WALLPAPER_BLUR } from "../../../shared/custom-theme";

// Exercise the real current-user guards with only the external identity lookup replaced.
vi.mock("../auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../auth")>();
  return {
    ...original,
    authComponent: {
      ...original.authComponent,
      safeGetAuthUser: async (ctx: QueryCtx) => {
        const identity = await ctx.auth.getUserIdentity();
        return identity ? { _id: identity.subject } : null;
      },
    },
  };
});

const modules = import.meta.glob("/src/**/*.*s");
const imageUrl = "https://example.com/wallpaper.png";

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const createUser = async (name: string) => ctx.db.insert("users", {
      authUserId: name, uniqueId: name, firstName: name, lastName: "Test",
      roles: ["STUDENT"], isStudent: true, isTeacherStaff: false,
      isStudentAdmin: false, isOtherRole: false, isActive: true,
      mustResetPassword: false, dashboardLayout: [], searchText: name,
      customBackgroundStorageId: await ctx.storage.store(new Blob([name])), customBackgroundUrl: imageUrl,
      customBackgroundPalette: ["#112233", "#445566"], customBackgroundTint: "#112233",
      createdAt: 1, updatedAt: 1,
    });
    return { alice: await createUser("Alice"), bob: await createUser("Bob") };
  });
  return { t, ids, user: t.withIdentity({ subject: "Alice" }) };
}

describe("custom wallpaper preferences", () => {
  test("saves blur, including zero, on only the authenticated account and restores it", async () => {
    const { t, ids, user } = await fixture();
    for (const blur of [MAX_WALLPAPER_BLUR, 8, 0]) {
      expect((await user.mutation(api.users.me.setCustomBackgroundBlur, { blur })).customBackgroundBlur).toBe(blur);
      expect((await user.query(api.users.me.me, {}))?.customBackgroundBlur).toBe(blur);
    }
    expect((await t.run(ctx => ctx.db.get(ids.bob)))?.customBackgroundBlur).toBeUndefined();
  });

  test.each([-1, 25, 1.5, NaN, Infinity])("rejects invalid blur %s", async (blur) => {
    const { user } = await fixture();
    await expect(user.mutation(api.users.me.setCustomBackgroundBlur, { blur })).rejects.toThrow("Blur must be between");
  });

  test("disables tint, keeps it off after resampling, and allows re-enabling a sampled color", async () => {
    const { t, ids, user } = await fixture();
    expect((await user.mutation(api.users.me.setCustomBackgroundTint, { tint: null })).customBackgroundTint).toBeNull();
    expect((await user.query(api.users.me.me, {}))?.customBackgroundTint).toBeNull();
    const sampled = await user.mutation(api.users.me.setCustomBackgroundPalette, {
      palette: ["#445566", "#778899"], expectedUrl: imageUrl,
    });
    expect(sampled.customBackgroundTint).toBeNull();
    expect((await t.run(ctx => ctx.db.get(ids.bob)))?.customBackgroundTint).toBe("#112233");
    expect((await user.mutation(api.users.me.setCustomBackgroundTint, { tint: "#778899" })).customBackgroundTint).toBe("#778899");
  });

  test("retains a selected tint when resampling still includes it", async () => {
    const { user } = await fixture();
    const sampled = await user.mutation(api.users.me.setCustomBackgroundPalette, {
      palette: ["#445566", "#112233"], expectedUrl: imageUrl,
    });
    expect(sampled.customBackgroundTint).toBe("#112233");
  });

  test("still rejects unsampled tint colors, stale samples, and unauthenticated writes", async () => {
    const { t, user } = await fixture();
    await expect(user.mutation(api.users.me.setCustomBackgroundTint, { tint: "#ffffff" })).rejects.toThrow("Choose a color");
    await expect(user.mutation(api.users.me.setCustomBackgroundPalette, {
      palette: ["#112233"], expectedUrl: "https://example.com/old.png",
    })).rejects.toThrow("Background image changed");
    await expect(t.mutation(api.users.me.setCustomBackgroundBlur, { blur: 0 })).rejects.toThrow("Unauthenticated");
    await expect(t.mutation(api.users.me.setCustomBackgroundTint, { tint: null })).rejects.toThrow("Unauthenticated");
  });

  test("clears wallpaper preferences when removing the image and rejects later blur changes", async () => {
    const { user } = await fixture();
    await user.mutation(api.users.me.setCustomBackgroundBlur, { blur: 12 });
    await user.mutation(api.users.me.setCustomBackgroundTint, { tint: null });
    const cleared = await user.mutation(api.users.me.clearUserImage, { kind: "background" });
    expect(cleared.customBackgroundUrl).toBeUndefined();
    expect(cleared.customBackgroundTint).toBeUndefined();
    expect(cleared.customBackgroundBlur).toBeUndefined();
    await expect(user.mutation(api.users.me.setCustomBackgroundBlur, { blur: 0 })).rejects.toThrow("Upload a background");
  });
});
