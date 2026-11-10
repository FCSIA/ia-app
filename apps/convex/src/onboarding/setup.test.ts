/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { Infer } from "convex/values";
import schema from "../schema";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  SCHEDULE_NOT_READY_ERROR,
  ONBOARDING_STEPS,
  onboardingSteps,
  onboardingSaveError,
  type OnboardingStepId,
} from "../../../shared/onboarding";
import { insertUser } from "../../test/fixtures";
import { stepIdValidator } from "./validators";

vi.mock("../../lib/currentUser", async (original) =>
  (await import("../../test/auth")).currentUserFromIdentity(await original(), { requireActive: true }),
);
const modules = import.meta.glob("/src/**/*.*s");
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) =>
    Promise.all(
      ["new", "legacy", "staff"].map((name, i) =>
        insertUser(ctx, { uniqueId: name, firstName: name, lastName: "Test", roles: i === 2 ? ["TEACHER"] : ["STUDENT"], onboardingVersion: i === 0 ? 1 : undefined }),
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
    expect(onboardingSaveError({ data: SCHEDULE_NOT_READY_ERROR })).toBe(
      SCHEDULE_NOT_READY_ERROR,
    );
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
    const afterRoleChange = await secondDevice.query(api.onboarding.setup.get, {});
    expect(afterRoleChange?.phase).toBe("completed");
    expect(
      afterRoleChange?.steps.find((s) => s.id === "flex")?.state,
    ).toBe("pending");
  });
  it("shows no setup to super admins", async () => {
    const { t, ids, user } = await fixture();
    await t.run((ctx) => ctx.db.patch(ids[0], { roles: ["SUPER_ADMIN"] }));
    expect(await user.query(api.onboarding.setup.get, {})).toBeNull();
  });
  it("uses student steps for mixed roles and excludes them for staff", async () => {
    const { staff } = await fixture();
    expect(onboardingSteps(["STUDENT_LEADER"])).toHaveLength(5);
    expect((await staff.query(api.onboarding.setup.get, {}))?.total).toBe(4);
    await staff.mutation(api.onboarding.setup.start, {});
    await expect(
      staff.mutation(api.onboarding.setup.decide, {
        step: "privacy",
        decision: "done",
      }),
    ).rejects.toThrow("not available");
  });
  it("tailors steps to each role and unions mixed roles in a stable order", () => {
    const ids = (roles: string[]) => onboardingSteps(roles).map((s) => s.id);
    const student = ["profile", "schedule", "privacy", "notifications", "essentials"];
    expect(ids(["STUDENT"])).toEqual(student);
    expect(ids(["STUDENT", "STUDENT_LEADER"])).toEqual(student);
    expect(ids(["STUDENT", "STUDENT_ADMIN"])).toEqual([
      "profile", "schedule", "privacy", "notifications", "flex", "essentials",
    ]);
    expect(ids(["TEACHER"])).toEqual(["profile", "notifications", "flex", "essentials"]);
    expect(ids(["SPONSOR"])).toEqual(["profile", "notifications", "clubs", "essentials"]);
    expect(ids(["SUPPORT_STAFF"])).toEqual(["profile", "notifications", "admin", "essentials"]);
    expect(ids(["ADMIN"])).toEqual([
      "profile", "notifications", "admin", "schoolDay", "essentials",
    ]);
    expect(ids(["SPONSOR", "TEACHER", "SUPPORT_STAFF", "ADMIN"])).toEqual([
      "profile", "notifications", "flex", "clubs", "admin", "schoolDay", "essentials",
    ]);
    expect(ids(["TEACHER", "STUDENT_ADMIN"])).toEqual(ids(["STUDENT_ADMIN", "TEACHER"]));
    expect(ids(["SUPER_ADMIN", "TEACHER", "STUDENT"])).toEqual([]);
    const essentials = (roles: string[]) =>
      onboardingSteps(roles).find((s) => s.id === "essentials")?.description;
    expect(essentials(["TEACHER"])).not.toBe(essentials(["STUDENT"]));
    expect(essentials(["TEACHER", "STUDENT"])).toBe(essentials(["STUDENT"]));
  });
  it("keeps the stored step validator in step with the shared step list", () => {
    expectTypeOf<Infer<typeof stepIdValidator>>().toEqualTypeOf<OnboardingStepId>();
    expect(stepIdValidator.members.map((m) => m.value)).toEqual(
      ONBOARDING_STEPS.map((s) => s.id),
    );
  });
  it("adds pending work for gained roles and drops lost roles from the count while keeping their decisions", async () => {
    const { t, ids, staff } = await fixture();
    await staff.mutation(api.onboarding.setup.start, {});
    await staff.mutation(api.onboarding.setup.decide, {
      step: "flex",
      decision: "done",
    });
    await t.run((ctx) => ctx.db.patch(ids[2], { roles: ["TEACHER", "SPONSOR"] }));
    let current = await staff.query(api.onboarding.setup.get, {});
    expect(current?.total).toBe(5);
    expect(current?.steps.find((s) => s.id === "clubs")?.state).toBe("pending");
    expect(current?.steps.find((s) => s.id === "flex")?.state).toBe("done");
    await t.run((ctx) => ctx.db.patch(ids[2], { roles: ["SPONSOR"] }));
    current = await staff.query(api.onboarding.setup.get, {});
    expect(current?.steps.map((s) => s.id)).not.toContain("flex");
    expect(current?.resolved).toBe(0);
    await expect(
      staff.mutation(api.onboarding.setup.decide, { step: "flex", decision: "done" }),
    ).rejects.toThrow("not available");
    await t.run((ctx) => ctx.db.patch(ids[2], { roles: ["TEACHER"] }));
    current = await staff.query(api.onboarding.setup.get, {});
    expect(current?.steps.find((s) => s.id === "flex")?.state).toBe("done");
  });
  it("never reopens or credits finished setup, and offers new steps for review instead", async () => {
    const { t, ids, staff } = await fixture();
    await staff.mutation(api.onboarding.setup.start, {});
    for (const step of onboardingSteps(["TEACHER"]))
      await staff.mutation(api.onboarding.setup.decide, {
        step: step.id,
        decision: "done",
      });
    await staff.mutation(api.onboarding.setup.finish, {});
    await t.run((ctx) => ctx.db.patch(ids[2], { roles: ["TEACHER", "ADMIN"] }));
    let current = await staff.query(api.onboarding.setup.get, {});
    expect(current?.phase).toBe("completed");
    expect(current?.total).toBe(6);
    expect(current?.resolved).toBe(4);
    expect(current?.steps.find((s) => s.id === "admin")?.state).toBe("pending");
    await staff.mutation(api.onboarding.setup.later, {});
    await staff.mutation(api.onboarding.setup.start, {});
    expect((await staff.query(api.onboarding.setup.get, {}))?.phase).toBe("completed");
    await staff.mutation(api.onboarding.setup.decide, {
      step: "admin",
      decision: "skipped",
    });
    current = await staff.query(api.onboarding.setup.get, {});
    expect(current?.phase).toBe("completed");
    expect(current?.resolved).toBe(5);
  });
  it("leaves version 1 records complete while new role steps wait for review", async () => {
    const { t, ids, staff } = await fixture();
    await t.run((ctx) =>
      ctx.db.insert("onboardingStates", {
        userId: ids[2],
        version: 1,
        startedAt: 1,
        completedAt: 2,
        decisions: { profile: "done", notifications: "skipped", essentials: "done" },
      }),
    );
    const current = await staff.query(api.onboarding.setup.get, {});
    expect(current?.phase).toBe("completed");
    expect(current?.steps).toEqual([
      { id: "profile", state: "done" },
      { id: "notifications", state: "skipped" },
      { id: "flex", state: "pending" },
      { id: "essentials", state: "done" },
    ]);
  });
  it("rejects setup mutations from super admins, whatever their other roles", async () => {
    const { t, ids, user } = await fixture();
    await t.run((ctx) =>
      ctx.db.patch(ids[0], { roles: ["SUPER_ADMIN", "STUDENT"] }),
    );
    expect(await user.query(api.onboarding.setup.get, {})).toBeNull();
    for (const mutation of [
      api.onboarding.setup.start,
      api.onboarding.setup.later,
      api.onboarding.setup.finish,
    ])
      await expect(user.mutation(mutation, {})).rejects.toThrow("not available");
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
