/// <reference types="vite/client" />

import { hashPassword, verifyPassword } from "better-auth/crypto";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { components, internal } from "./_generated/api";
import authSchema from "./betterAuth/schema";
import schema from "./schema";
import { LOCAL_DEMO_PASSWORD } from "./seed";
import { createLinkedUser, setBetterAuthPassword } from "./users/_lib";

const modules = import.meta.glob("./**/*.*s");
const authModules = import.meta.glob("./betterAuth/**/*.*s");

function setup() {
  const t = convexTest({ schema, modules, transactionLimits: true });
  t.registerComponent("betterAuth", authSchema, authModules);
  return t;
}

async function accounts(t: ReturnType<typeof setup>) {
  return t.run(async (ctx) => {
    const users = await ctx.db.query("users").withIndex("by_uniqueId").take(16);
    return Promise.all(
      users.map(async (user) => {
        const account = await ctx.runQuery(
          components.betterAuth.adapter.findOne,
          {
            model: "account",
            where: [
              { field: "userId", value: user.authUserId! },
              { field: "providerId", value: "credential" },
            ],
          },
        );
        if (!account?.password) throw new Error("Missing credential account");
        return { user, hash: account.password };
      }),
    );
  });
}

beforeEach(() => {
  vi.stubEnv("ALLOW_LOCAL_DEMO_SEED", "true");
  vi.stubEnv("BETTER_AUTH_SECRET", "seed-test-secret-at-least-32-characters");
});
afterEach(() => vi.unstubAllEnvs());

describe("local demo password hashing", () => {
  it("reuses the supplied normal hash across batches without changing verification or counts", async () => {
    const t = setup();
    const passwordHash = await hashPassword(LOCAL_DEMO_PASSWORD);
    for (const cursor of ["0", "8", "0"]) {
      await t.mutation(internal.seed.run, {
        cursor,
        batchSize: 8,
        passwordHash,
      });
    }

    const linked = await accounts(t);
    expect(linked).toHaveLength(16);
    expect(
      linked.every(
        ({ hash, user }) => hash === passwordHash && !user.mustResetPassword,
      ),
    ).toBe(true);
    expect(
      await verifyPassword({
        hash: linked[0].hash,
        password: LOCAL_DEMO_PASSWORD,
      }),
    ).toBe(true);
    expect(
      await verifyPassword({
        hash: linked[0].hash,
        password: "incorrect-password",
      }),
    ).toBe(false);
    const counts = await t.run((ctx) =>
      ctx.db
        .query("appStats")
        .withIndex("by_key", (q) => q.eq("key", "user-counts"))
        .unique(),
    );
    expect(counts?.users).toBe(16);
  });

  it("still refuses demo writes when the local-demo guard is off", async () => {
    const t = setup();
    vi.stubEnv("ALLOW_LOCAL_DEMO_SEED", "false");
    await expect(
      t.mutation(internal.seed.run, { passwordHash: "unused" }),
    ).rejects.toThrow("Demo seed is disabled");
    expect(await accounts(t)).toEqual([]);
  });

  it("fails an old or incomplete users step before creating accounts", async () => {
    const t = setup();
    await t.run((ctx) =>
      ctx.db.insert("seedRuns", {
        key: "demo-reset",
        runId: "missing-hash",
        phase: "users",
        status: "RUNNING",
        startedAt: 1,
        updatedAt: 1,
      }),
    );
    await t.mutation(internal.bootstrap.resetAndSeedStep, {
      phase: "users",
      runId: "missing-hash",
      profile: "development",
    });
    expect(await t.query(internal.bootstrap.seedStatus, {})).toMatchObject({
      status: "FAILED",
      error: expect.stringContaining("Restart the demo seed"),
    });
    expect(await accounts(t)).toEqual([]);
  });

  it("keeps ordinary account creation independently salted and password changes normally hashed", async () => {
    const t = setup();
    for (const uniqueId of ["HASH001", "HASH002"]) {
      await t.run((ctx) =>
        createLinkedUser(ctx, {
          uniqueId,
          firstName: "Normal",
          lastName: "Account",
          password: LOCAL_DEMO_PASSWORD,
        }),
      );
    }
    const linked = await accounts(t);
    expect(linked[0].hash).not.toBe(linked[1].hash);
    expect(
      await verifyPassword({
        hash: linked[0].hash,
        password: LOCAL_DEMO_PASSWORD,
      }),
    ).toBe(true);
    await t.run((ctx) =>
      setBetterAuthPassword(
        ctx,
        linked[0].user.authUserId!,
        "Changed-password-42",
      ),
    );
    const updated = await accounts(t);
    expect(updated[0].hash).not.toBe(linked[0].hash);
    expect(updated[1].hash).toBe(linked[1].hash);
    expect(
      await verifyPassword({
        hash: updated[0].hash,
        password: "Changed-password-42",
      }),
    ).toBe(true);
    expect(
      await verifyPassword({
        hash: updated[0].hash,
        password: LOCAL_DEMO_PASSWORD,
      }),
    ).toBe(false);
  });
});
