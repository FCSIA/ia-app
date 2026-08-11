import { ConvexError } from "convex/values";
import type {
  ScheduleLunchPeriod,
  ScheduleWeekday,
} from "../validators";

export const CANONICAL_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const DEFAULT_LUNCH_PERIOD: ScheduleLunchPeriod = "PERIOD_5";
export const MAX_DAY_BLOCKS = 24;

export type DayBlockInput = {
  label: string;
  periodNumber?: number | null;
  startTime: string;
  endTime: string;
};

export type NormalizedDayBlock = {
  position: number;
  label: string;
  periodNumber: number | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
};

export type CanonicalScheduleEntry = {
  weekday: ScheduleWeekday;
  periodNumber: number;
  className: string;
  courseId?: unknown;
  [key: string]: unknown;
};

export type ResolvedDayBlock<TEntry extends CanonicalScheduleEntry> =
  NormalizedDayBlock & {
    key: string;
    kind: "PERIOD" | "LUNCH" | "CUSTOM";
    displayLabel: string;
    entry: TEntry | null;
  };

export type ResolveSchoolDayInput<TEntry extends CanonicalScheduleEntry> = {
  dateKey: string;
  lunchPeriod?: ScheduleLunchPeriod | null;
  entries: TEntry[];
  regularBlocks: DayBlockInput[];
  override?: {
    name: string;
    blocks: DayBlockInput[];
  } | null;
};

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function dateKeyForSchoolTime(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

export function normalizeDateKey(value: string) {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) {
    throw new ConvexError("Dates must use YYYY-MM-DD.");
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ConvexError("Date is not valid.");
  }
  return value;
}

export function weekdayForDateKey(dateKey: string): ScheduleWeekday | null {
  const normalized = normalizeDateKey(dateKey);
  const date = new Date(`${normalized}T12:00:00.000Z`);
  const weekdays: Array<ScheduleWeekday | null> = [
    null,
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    null,
  ];
  return weekdays[date.getUTCDay()] ?? null;
}

export function academicDateDisposition(
  dateKey: string,
  startDateKey?: string,
  endDateKey?: string,
) {
  const normalized = normalizeDateKey(dateKey);
  if (
    !startDateKey ||
    !endDateKey ||
    normalized < normalizeDateKey(startDateKey) ||
    normalized > normalizeDateKey(endDateKey)
  ) {
    return "OUTSIDE_YEAR" as const;
  }
  const weekday = weekdayForDateKey(normalized);
  if (!weekday) return "WEEKEND" as const;
  if (weekday === "FRIDAY") return "UNASSIGNED_FRIDAY" as const;
  return "DEFAULT_TEMPLATE" as const;
}

export function parseScheduleTime(value: string) {
  const match = TIME_PATTERN.exec(value);
  if (!match) throw new ConvexError(`Invalid time "${value}".`);
  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
}

export function normalizeDayBlocks(
  blocks: DayBlockInput[],
  options: { allowEmpty?: boolean } = {},
): NormalizedDayBlock[] {
  if (!options.allowEmpty && blocks.length === 0) {
    throw new ConvexError("A day plan needs at least one block.");
  }
  if (blocks.length > MAX_DAY_BLOCKS) {
    throw new ConvexError(`A day plan can have at most ${MAX_DAY_BLOCKS} blocks.`);
  }

  const seenPeriods = new Set<number>();
  let previousEnd = -1;

  return blocks.map((block, position) => {
    const periodNumber = block.periodNumber ?? null;
    if (
      periodNumber !== null &&
      (!Number.isInteger(periodNumber) || periodNumber < 1 || periodNumber > 8)
    ) {
      throw new ConvexError("Canonical periods must be between 1 and 8.");
    }
    if (periodNumber !== null && seenPeriods.has(periodNumber)) {
      throw new ConvexError(`Period ${periodNumber} can appear only once in a day plan.`);
    }
    if (periodNumber !== null) seenPeriods.add(periodNumber);

    const startMinutes = parseScheduleTime(block.startTime);
    const endMinutes = parseScheduleTime(block.endTime);
    if (endMinutes <= startMinutes) {
      throw new ConvexError("Every block must end after it starts.");
    }
    if (startMinutes < previousEnd) {
      throw new ConvexError("Day-plan blocks must be ordered and cannot overlap.");
    }
    previousEnd = endMinutes;

    const label = block.label.trim() ||
      (periodNumber === null ? "Custom block" : `Period ${periodNumber}`);
    return {
      position,
      label,
      periodNumber,
      startTime: block.startTime,
      endTime: block.endTime,
      durationMinutes: endMinutes - startMinutes,
    };
  });
}

export function lunchPeriodNumber(lunchPeriod: ScheduleLunchPeriod) {
  return lunchPeriod === "PERIOD_4" ? 4 : 5;
}

export function resolveLunchPeriod(
  lunchPeriod: ScheduleLunchPeriod | undefined,
  entries: Array<Pick<CanonicalScheduleEntry, "periodNumber">> = [],
): ScheduleLunchPeriod | null {
  return lunchPeriod ?? inferLegacyLunchPeriod(entries);
}

export function inferLegacyLunchPeriod(
  entries: Array<Pick<CanonicalScheduleEntry, "periodNumber">>,
): ScheduleLunchPeriod | null {
  const hasPeriod4 = entries.some((entry) => entry.periodNumber === 4);
  const hasPeriod5 = entries.some((entry) => entry.periodNumber === 5);
  if (!hasPeriod4 && hasPeriod5) return "PERIOD_4";
  if (hasPeriod4 && !hasPeriod5) return "PERIOD_5";
  if (!hasPeriod4 && !hasPeriod5) return DEFAULT_LUNCH_PERIOD;
  return null;
}

export function assertNoLunchCourseConflict(
  entries: Array<Pick<CanonicalScheduleEntry, "weekday" | "periodNumber">>,
  lunchPeriod: ScheduleLunchPeriod,
) {
  const periodNumber = lunchPeriodNumber(lunchPeriod);
  const conflict = findLunchCourseConflict(entries, lunchPeriod);
  if (conflict) {
    throw new ConvexError(
      `Period ${periodNumber} still has a class on ${conflict.weekday.toLowerCase()}. Remove or move it before changing lunch.`,
    );
  }
}

export function findLunchCourseConflict(
  entries: Array<Pick<CanonicalScheduleEntry, "weekday" | "periodNumber">>,
  lunchPeriod: ScheduleLunchPeriod,
) {
  const periodNumber = lunchPeriodNumber(lunchPeriod);
  return entries.find((entry) => entry.periodNumber === periodNumber) ?? null;
}

export function resolveSchoolDay<TEntry extends CanonicalScheduleEntry>(
  input: ResolveSchoolDayInput<TEntry>,
) {
  const dateKey = normalizeDateKey(input.dateKey);
  const weekday = weekdayForDateKey(dateKey);
  const lunchPeriod =
    input.lunchPeriod === null
      ? null
      : resolveLunchPeriod(input.lunchPeriod, input.entries);
  const lunchNumber = lunchPeriod ? lunchPeriodNumber(lunchPeriod) : null;
  const isSpecial = input.override != null;
  const sourceBlocks = input.override?.blocks ?? (weekday ? input.regularBlocks : []);
  const blocks = normalizeDayBlocks(sourceBlocks, {
    allowEmpty: sourceBlocks.length === 0,
  });
  const presentPeriods = new Set<number>();

  const resolvedBlocks: Array<ResolvedDayBlock<TEntry>> = blocks.map((block) => {
    const periodNumber = block.periodNumber;
    if (periodNumber !== null) presentPeriods.add(periodNumber);
    const isLunch = periodNumber === lunchNumber;
    const entry =
      weekday && periodNumber !== null && !isLunch
        ? input.entries.find(
            (candidate) =>
              candidate.weekday === weekday &&
              candidate.periodNumber === periodNumber,
          ) ??
          input.entries.find(
            (candidate) => candidate.periodNumber === periodNumber,
          ) ??
          null
        : null;
    const kind = periodNumber === null ? "CUSTOM" : isLunch ? "LUNCH" : "PERIOD";
    return {
      ...block,
      key: `${dateKey}:${block.position}:${periodNumber ?? "custom"}`,
      kind,
      displayLabel: isLunch ? "Lunch" : block.label,
      entry,
    };
  });

  return {
    dateKey,
    weekday,
    lunchPeriod,
    lunchNeedsResolution: lunchPeriod === null,
    isSpecial,
    name: input.override?.name ?? (weekday ? "Regular schedule" : "No school schedule"),
    blocks: resolvedBlocks,
    omittedPeriods: CANONICAL_PERIODS.filter((period) => !presentPeriods.has(period)),
  };
}
