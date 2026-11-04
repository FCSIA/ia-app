/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import schema from "../schema";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  onboardingSteps,
  onboardingSaveError,
} from "../../../shared/onboarding";

vi.mock("../../lib/currentUser", async (original) => {
  const actual = await original<typeof import("../../lib/currentUser")>();
  const getMaybeCurrentAppUserUnchecked = async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    const user = identity
      ? await ctx.db.get(identity.subject as Id<"users">)
      : null;
    return user?.isActive ? user : null;
  };
  return {
    ...actual,
    getMaybeCurrentAppUserUnchecked,
    getCurrentAppUser: async (ctx: QueryCtx) => {
      const user = await getMaybeCurrentAppUserUnchecked(ctx);
      if (!user) throw new Error("Unauthenticated");
      actual.assertPasswordResetComplete(user);
      return user;
    },
  };
});
const modules = import.meta.glob("/src/**/*.*s");
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) =>
    Promise.all(
      ["new", "legacy", "staff"].map((name, i) =>
        ctx.db.insert("users", {
          uniqueId: name,
          firstName: name,
          lastName: "Test",
          roles: i === 2 ? ["TEACHER"] : ["STUDENT"],
          isStudent: i !== 2,
          isTeacherStaff: i === 2,
          isStudentAdmin: false,
          isOtherRole: false,
          isActive: true,
          mustResetPassword: false,
          dashboardLayout: [],
          searchText: name,
          onboardingVersion: i === 0 ? 1 : undefined,
          createdAt: 1,
          updatedAt: 1,
        }),
      ),
    ),
  );
  return {
    t,
    ids,
    user: t.withIdentity({ subject: ids[0] }),
    legacy: t.withIdentity({ subject: ids[1] }),
    staff: t.withIdentity({ subject: ids[2] }),
  };
}
describe("onboarding lifecycle and ownership", () => {
  it("shows actionable validation while hiding unexpected diagnostics", () => {
    const message =
      "Save classes and a lunch period in Schedule first, or skip for now.";
    expect(onboardingSaveError({ data: message })).toBe(message);
    expect(
      onboardingSaveError(
        new Error("[CONVEX request-id] Internal stack trace"),
      ),
    ).toBe("Could not save setup. Your progress is unchanged. Try again.");
  });
  it("invites only explicitly provisioned users, regardless of account age", async () => {
    const { user, legacy } = await fixture();
    expect((await user.query(api.onboarding.setup.get, {}))?.phase).toBe(
      "invited",
    );
    expect((await legacy.query(api.onboarding.setup.get, {}))?.phase).toBe(
      "available",
    );
    await legacy.mutation(api.onboarding.setup.start, {});
    expect((await legacy.query(api.onboarding.setup.get, {}))?.phase).toBe(
      "active",
    );
  });
  it("preserves decisions through durable Later and repeated start without affecting another account", async () => {
    const { user, legacy } = await fixture();
    await user.mutation(api.onboarding.setup.start, {});
    await user.mutation(api.onboarding.setup.decide, {
      step: "profile",
      decision: "done",
    });
    await user.mutation(api.onboarding.setup.later, {});
    expect((await user.query(api.onboarding.setup.get, {}))?.phase).toBe(
      "deferred",
    );
    await expect(
      user.mutation(api.onboarding.setup.decide, {
        step: "privacy",
        decision: "done",
      }),
    ).rejects.toThrow("Start setup");
    await user.mutation(api.onboarding.setup.start, {});
    await user.mutation(api.onboarding.setup.start, {});
    expect((await user.query(api.onboarding.setup.get, {}))?.resolved).toBe(1);
    expect((await legacy.query(api.onboarding.setup.get, {}))?.resolved).toBe(
      0,
    );
  });
  it("credits real saved work, including notification opt-outs, and rejects empty or conflicting schedules", async () => {
    const { t, ids, user } = await fixture();
    await user.mutation(api.onboarding.setup.start, {});
    await expect(
      user.mutation(api.onboarding.setup.decide, {
        step: "schedule",
        decision: "done",
      }),
    ).rejects.toThrow("Save classes");
    const scheduleId = await t.run((ctx) =>
      ctx.db.insert("studentSchedules", {
        userId: ids[0],
        isPublic: false,
        lunchPeriod: "PERIOD_4",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    expect((await user.query(api.onboarding.setup.get, {}))?.resolved).toBe(0);
    const entryId = await t.run((ctx) =>
      ctx.db.insert("studentScheduleEntries", {
        userId: ids[0],
        scheduleId,
        courseId: null,
        className: "Math",
        periodNumber: 1,
        weekday: "MONDAY",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    expect((await user.query(api.onboarding.setup.get, {}))?.resolved).toBe(1);
    await t.run((ctx) => ctx.db.patch(entryId, { periodNumber: 4 }));
    expect((await user.query(api.onboarding.setup.get, {}))?.resolved).toBe(0);
    await t.run((ctx) =>
      ctx.db.insert("notificationPreferences", {
        userId: ids[0],
        category: "SCHOOL_ANNOUNCEMENT",
        scopeKey: "global",
        enabled: false,
        level: "OFF",
        locked: false,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    expect(
      (await user.query(api.onboarding.setup.get, {}))?.steps.find(
        (s) => s.id === "notifications",
      )?.state,
    ).toBe("done");
  });
  it("allows explicit skips, requires all steps, and latches completion across clients and role changes", async () => {
    const { t, ids, user } = await fixture();
    await user.mutation(api.onboarding.setup.start, {});
    await expect(
      user.mutation(api.onboarding.setup.finish, {}),
    ).rejects.toThrow("Review or skip");
    for (const step of onboardingSteps(["STUDENT"]))
      await user.mutation(api.onboarding.setup.decide, {
        step: step.id,
        decision: "skipped",
      });
    await user.mutation(api.onboarding.setup.finish, {});
    await user.mutation(api.onboarding.setup.finish, {});
    await user.mutation(api.onboarding.setup.start, {});
    await user.mutation(api.onboarding.setup.later, {});
    const secondDevice = t.withIdentity({ subject: ids[0] });
    expect(
      (await secondDevice.query(api.onboarding.setup.get, {}))?.phase,
    ).toBe("completed");
    await t.run((ctx) => ctx.db.patch(ids[0], { roles: ["TEACHER"] }));
    expect(
      (await secondDevice.query(api.onboarding.setup.get, {}))?.phase,
    ).toBe("completed");
  });
  it("shows no setup to super admins", async () => {
    const { t, ids, user } = await fixture();
    await t.run((ctx) => ctx.db.patch(ids[0], { roles: ["SUPER_ADMIN"] }));
    expect(await user.query(api.onboarding.setup.get, {})).toBeNull();
  });
  it("uses student steps for mixed roles and excludes them for staff", async () => {
    const { staff } = await fixture();
    expect(
      onboardingSteps(["STUDENT", "STUDENT_ADMIN", "TEACHER"]),
    ).toHaveLength(5);
    expect(onboardingSteps(["STUDENT_LEADER"])).toHaveLength(5);
    expect(onboardingSteps(["STUDENT_ADMIN"])).toHaveLength(5);
    expect((await staff.query(api.onboarding.setup.get, {}))?.total).toBe(3);
    await staff.mutation(api.onboarding.setup.start, {});
    await expect(
      staff.mutation(api.onboarding.setup.decide, {
        step: "privacy",
        decision: "done",
      }),
    ).rejects.toThrow("not available");
  });
  it("rejects anonymous, inactive, reset-required and caller-supplied user IDs", async () => {
    const { t, ids, user } = await fixture();
    expect(await t.query(api.onboarding.setup.get, {})).toBeNull();
    await expect(t.mutation(api.onboarding.setup.start, {})).rejects.toThrow(
      "Unauthenticated",
    );
    await expect(
      user.mutation(api.onboarding.setup.start, { userId: ids[1] } as never),
    ).rejects.toThrow();
    await t.run((ctx) => ctx.db.patch(ids[0], { mustResetPassword: true }));
    expect(await user.query(api.onboarding.setup.get, {})).toBeNull();
    await expect(user.mutation(api.onboarding.setup.start, {})).rejects.toThrow(
      "Password reset",
    );
    await t.run((ctx) =>
      ctx.db.patch(ids[0], { mustResetPassword: false, isActive: false }),
    );
    expect(await user.query(api.onboarding.setup.get, {})).toBeNull();
    await expect(user.mutation(api.onboarding.setup.start, {})).rejects.toThrow(
      "Unauthenticated",
    );
  });
});
