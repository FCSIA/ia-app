/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { adjustFlexSessionCount, countFlexSessions } from "./counts";

const modules = import.meta.glob("../**/*.*s");

async function seed(
  t: ReturnType<typeof convexTest>,
  { sessions, sessionCount }: { sessions: number; sessionCount?: number },
) {
  return t.run(async (ctx) => {
    const flexFridayId = await ctx.db.insert("flexFridays", {
      date: 1_000,
      type: "ALL_STUDENT",
      isSchoolDay: true,
      sessionCount,
      createdAt: 0,
    });

    for (let index = 0; index < sessions; index += 1) {
      await ctx.db.insert("flexSessions", {
        flexFridayId,
        title: `session ${index}`,
        startTime: "13:00",
        endTime: "14:30",
        sessionType: "STUDENT_CHOICE",
        createdAt: index,
        updatedAt: index,
      });
    }

    return flexFridayId;
  });
}

/** What `fridays.list` puts in `_count.sessions`, counter or fallback. */
async function listedCount(
  t: ReturnType<typeof convexTest>,
  flexFridayId: Id<"flexFridays">,
) {
  return t.run(async (ctx) => {
    const friday = await ctx.db.get(flexFridayId);
    return friday!.sessionCount ?? (await countFlexSessions(ctx, flexFridayId));
  });
}

describe("flex friday session counter", () => {
  it("reports the real count for Fridays written before the counter existed", async () => {
    const t = convexTest(schema, modules);
    const flexFridayId = await seed(t, { sessions: 3 });

    // The list is what students load, so it has to be right before the
    // backfill runs, not only after it.
    expect(await listedCount(t, flexFridayId)).toBe(3);
  });

  it("adopts the true count the first time a legacy Friday is adjusted", async () => {
    const t = convexTest(schema, modules);
    const flexFridayId = await seed(t, { sessions: 2 });

    await t.run(async (ctx) => {
      await adjustFlexSessionCount(ctx, flexFridayId, 1);
      await ctx.db.insert("flexSessions", {
        flexFridayId,
        title: "the new one",
        startTime: "13:00",
        endTime: "14:30",
        sessionType: "STUDENT_CHOICE",
        createdAt: 10,
        updatedAt: 10,
      });
    });

    expect(await listedCount(t, flexFridayId)).toBe(3);
  });

  it("tracks additions and removals once the counter is set", async () => {
    const t = convexTest(schema, modules);
    const flexFridayId = await seed(t, { sessions: 4, sessionCount: 4 });

    await t.run(async (ctx) => {
      await adjustFlexSessionCount(ctx, flexFridayId, -1);
    });
    expect(await listedCount(t, flexFridayId)).toBe(3);

    await t.run(async (ctx) => {
      await adjustFlexSessionCount(ctx, flexFridayId, 1);
    });
    expect(await listedCount(t, flexFridayId)).toBe(4);
  });

  it("never reports a negative count", async () => {
    const t = convexTest(schema, modules);
    const flexFridayId = await seed(t, { sessions: 0, sessionCount: 0 });

    await t.run(async (ctx) => {
      await adjustFlexSessionCount(ctx, flexFridayId, -1);
    });

    expect(await listedCount(t, flexFridayId)).toBe(0);
  });

  it("does not double-count a Friday created with its own sessions", async () => {
    // `fridays.create` sets the counter outright instead of adjusting, because
    // the Friday owns exactly the sessions inserted alongside it.
    const t = convexTest(schema, modules);
    const flexFridayId = await seed(t, { sessions: 2, sessionCount: 2 });

    expect(await listedCount(t, flexFridayId)).toBe(2);
  });
});
