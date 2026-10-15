import type { Doc } from "../_generated/dataModel";
import { schoolDayKey, weekStart } from "../analytics/_days";
import type { PushDevicePlatform } from "../validators";

const schoolHourClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  hourCycle: "h23",
});

export function schoolHour(ms: number) {
  return Number(schoolHourClock.format(new Date(ms))) % 24;
}

type LastSeen = Pick<
  Doc<"userActivity">,
  "lastHourKey" | "lastDay" | "lastWeek" | "lastDayByPlatform"
>;

type ActivityMark = Pick<
  Doc<"activityMarks">,
  "day" | "hour" | "platform" | "newHour" | "newDay" | "newWeek" | "newPlatformDay"
>;

/**
 * The anonymous mark a heartbeat should write, if any.
 *
 * A person counts once per hour toward the heatmap, once per day and week
 * toward active-people totals, and once per day per platform. A heartbeat that
 * adds nothing new writes nothing, so a person yields at most a few marks an
 * hour no matter how many tabs heartbeat.
 */
export function nextActivity(
  lastSeen: LastSeen | null,
  platform: PushDevicePlatform,
  now: number,
): { mark: ActivityMark; lastSeen: LastSeen } | null {
  const day = schoolDayKey(now);
  const hour = schoolHour(now);
  const hourKey = `${day}T${String(hour).padStart(2, "0")}`;
  const week = weekStart(day);

  const mark: ActivityMark = {
    day,
    hour,
    platform,
    newHour: lastSeen?.lastHourKey !== hourKey,
    newDay: lastSeen?.lastDay !== day,
    newWeek: lastSeen?.lastWeek !== week,
    newPlatformDay: lastSeen?.lastDayByPlatform[platform] !== day,
  };
  if (!mark.newHour && !mark.newPlatformDay) return null;

  return {
    mark,
    lastSeen: {
      lastHourKey: hourKey,
      lastDay: day,
      lastWeek: week,
      lastDayByPlatform: { ...lastSeen?.lastDayByPlatform, [platform]: day },
    },
  };
}
