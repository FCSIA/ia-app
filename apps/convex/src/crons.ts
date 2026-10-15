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
crons.interval(
  "prune erased whiteboard elements",
  { hours: 6 },
  internal.clubs.whiteboards.pruneErasedWhiteboardElements,
  {},
);
crons.interval(
  "refresh external calendar feeds",
  { hours: 6 },
  internal.events.externalCalendarSync.refreshDue,
  {},
);

// 04:30 New York (EDT; 03:30 EST): after the school day ends, before anyone is in.
crons.cron("roll up admin analytics", "30 8 * * *", internal.analytics.rollups.runDaily, {});

export default crons;
