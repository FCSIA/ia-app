import { Migrations } from "@convex-dev/migrations";
import { v } from "convex/values";
import { getCurrentAppUser } from "../../lib/currentUser";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireScheduleAdmin } from "./_lib";
import { inferLegacyLunchPeriod } from "./dayResolver";

const migrations = new Migrations<DataModel>(components.migrations);

export const backfillLunchPeriod = migrations.define({
  table: "studentSchedules",
  batchSize: 10,
  migrateOne: async (ctx, schedule) => {
    if (schedule.lunchPeriod !== undefined) return;
    const entries = await ctx.db
      .query("studentScheduleEntries")
      .withIndex("by_scheduleId_and_weekday_and_periodNumber", (q) =>
        q.eq("scheduleId", schedule._id),
      )
      .take(60);
    const lunchPeriod = inferLegacyLunchPeriod(entries);
    if (!lunchPeriod) return;
    return { lunchPeriod };
  },
});

export const getLunchMigrationReport = query({
  args: {},
  returns: v.object({
    sampled: v.number(),
    safeToBackfill: v.number(),
    unresolvedScheduleIds: v.array(v.id("studentSchedules")),
    hasMore: v.boolean(),
  }),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    requireScheduleAdmin(user);
    const schedules = await ctx.db
      .query("studentSchedules")
      .withIndex("by_lunchPeriod", (q) => q.eq("lunchPeriod", undefined))
      .take(51);
    const sample = schedules.slice(0, 50);
    const unresolvedScheduleIds = [];
    let safeToBackfill = 0;
    for (const schedule of sample) {
      const entries = await ctx.db
        .query("studentScheduleEntries")
        .withIndex("by_scheduleId_and_weekday_and_periodNumber", (q) =>
          q.eq("scheduleId", schedule._id),
        )
        .take(60);
      if (inferLegacyLunchPeriod(entries)) safeToBackfill += 1;
      else unresolvedScheduleIds.push(schedule._id);
    }
    return {
      sampled: sample.length,
      safeToBackfill,
      unresolvedScheduleIds,
      hasMore: schedules.length > sample.length,
    };
  },
});
