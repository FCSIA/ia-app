/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

describe("bootstrap seed status", () => {
  it("reports IDLE without a seed run", async () => {
    const t = convexTest(schema, modules);

    await expect(t.query(internal.bootstrap.seedStatus, {})).resolves.toEqual({
      runId: null,
      status: "IDLE",
      profile: null,
      phase: null,
      cursor: null,
      startedAt: null,
      updatedAt: null,
      completedAt: null,
      error: null,
      credentialsAvailable: false,
    });
  });

  it("reads progress from the single seedRuns document", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("seedRuns", {
        key: "demo-reset",
        runId: "run-1",
        phase: "users",
        status: "RUNNING",
        profile: "development",
        cursor: "12",
        startedAt: 100,
        updatedAt: 200,
        completedAt: null,
        error: null,
      });
    });

    await expect(t.query(internal.bootstrap.seedStatus, {})).resolves.toEqual({
      runId: "run-1",
      status: "RUNNING",
      profile: "development",
      phase: "users",
      cursor: "12",
      startedAt: 100,
      updatedAt: 200,
      completedAt: null,
      error: null,
      credentialsAvailable: false,
    });
  });

  it("infers status for seed records created by older code", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("seedRuns", {
        key: "demo-reset",
        runId: "old-run",
        phase: "clubs",
        startedAt: 100,
        updatedAt: 200,
      });
    });

    const status = await t.query(internal.bootstrap.seedStatus, {});
    expect(status.status).toBe("RUNNING");
    expect(status.profile).toBeNull();
  });

  it("refuses the destructive start phase when local demo seeding is disabled", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(internal.bootstrap.resetAndSeedStep, {
        phase: "start",
        runId: "blocked-run",
        profile: "development",
      }),
    ).rejects.toThrow("Demo seed is disabled");

    await expect(t.query(internal.bootstrap.seedStatus, {})).resolves.toMatchObject({
      status: "IDLE",
    });
  });

  it("returns completed-run credentials once and deletes the claimed records", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("seedRuns", {
        key: "demo-reset",
        runId: "complete-run",
        phase: "complete",
        status: "COMPLETE",
        profile: "development",
        cursor: null,
        startedAt: 100,
        updatedAt: 200,
        completedAt: 200,
        error: null,
      });
      await ctx.db.insert("seedCredentials", {
        runId: "complete-run",
        uniqueId: "STU001",
        temporaryPassword: "one-time-secret",
        createdAt: 150,
      });
    });

    await expect(t.query(internal.bootstrap.seedStatus, {})).resolves.toMatchObject({
      credentialsAvailable: true,
    });
    await expect(
      t.mutation(internal.bootstrap.claimSeedCredentials, {
        runId: "complete-run",
      }),
    ).resolves.toEqual({
      credentials: [
        { uniqueId: "STU001", temporaryPassword: "one-time-secret" },
      ],
      remaining: false,
    });
    await expect(
      t.mutation(internal.bootstrap.claimSeedCredentials, {
        runId: "complete-run",
      }),
    ).resolves.toEqual({ credentials: [], remaining: false });
    await expect(t.query(internal.bootstrap.seedStatus, {})).resolves.toMatchObject({
      credentialsAvailable: false,
    });
  });
});
