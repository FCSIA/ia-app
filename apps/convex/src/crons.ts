import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.daily("sweep orphaned uploads", { hourUTC: 3, minuteUTC: 15 }, internal.uploads.orphanCleanup.sweep, {});
crons.daily(
  "expire unclaimed seed credentials",
  { hourUTC: 3, minuteUTC: 45 },
  internal.bootstrap.sweepExpiredSeedCredentials,
  {},
);
crons.cron(
  "refresh Wrapped snapshots",
  "0 7 * * *",
  internal.wrapped.snapshots.refreshCurrentSchoolYear,
  {},
);

export default crons;
