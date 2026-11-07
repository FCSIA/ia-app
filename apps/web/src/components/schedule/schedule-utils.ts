import { SCHEDULE_HREF } from '~/apps/shared/routes';
import { clockMinutes } from '~/apps/shared/school-time';
import {
  ScheduleWeekday,
  SchoolDayBlock,
  StudentScheduleDraftEntry,
} from "./types";

type ScheduleEntryContainer = {
  entries: StudentScheduleDraftEntry[];
};

export const WEEKDAYS: Array<{
  value: ScheduleWeekday;
  shortLabel: string;
  label: string;
}> = [
  { value: "MONDAY", shortLabel: "Mon", label: "Monday" },
  { value: "TUESDAY", shortLabel: "Tue", label: "Tuesday" },
  { value: "WEDNESDAY", shortLabel: "Wed", label: "Wednesday" },
  { value: "THURSDAY", shortLabel: "Thu", label: "Thursday" },
  { value: "FRIDAY", shortLabel: "Fri", label: "Friday" },
];

export const DAY_PLAN_SECTIONS = [
  { id: "dates", label: "Calendar dates" },
  { id: "templates", label: "Templates" },
  { id: "config", label: "School config" },
] as const;

export type DayPlanSectionId = (typeof DAY_PLAN_SECTIONS)[number]["id"];

export function resolveDayPlanSection(requested: string | null | undefined): DayPlanSectionId {
  return DAY_PLAN_SECTIONS.find((section) => section.id === requested)?.id ?? "dates";
}

/** The Schedule admin tab on one day-plan section; other query parameters are kept. */
export function dayPlanHref(
  section: DayPlanSectionId,
  current?: { toString(): string } | null,
) {
  const params = new URLSearchParams(current?.toString());
  params.set("tab", "admin");
  params.set("section", section);
  return `${SCHEDULE_HREF}?${params}`;
}

export function getWeekdayForDate(date: Date): ScheduleWeekday | null {
  const day = date.getDay();
  if (day === 1) return "MONDAY";
  if (day === 2) return "TUESDAY";
  if (day === 3) return "WEDNESDAY";
  if (day === 4) return "THURSDAY";
  if (day === 5) return "FRIDAY";
  return null;
}

export function getBlocksForDay(
  blocks: SchoolDayBlock[],
  weekday: ScheduleWeekday,
) {
  return blocks
    .filter((block) => block.weekday === weekday)
    .sort(
      (left, right) =>
        clockMinutes(left.startTime) -
        clockMinutes(right.startTime),
    );
}

export function getPeriodNumbersForDay(
  blocks: SchoolDayBlock[],
  weekday: ScheduleWeekday,
) {
  const periodNumbers = getBlocksForDay(blocks, weekday)
    .map((block) => block.periodNumber)
    .filter((value): value is number => typeof value === "number");

  if (periodNumbers.length > 0)
    return Array.from(new Set(periodNumbers)).sort(
      (left, right) => left - right,
    );

  return [1, 2, 3, 4, 5, 6, 7, 8];
}

export function findScheduleEntry(
  schedule: ScheduleEntryContainer | null,
  weekday: ScheduleWeekday,
  periodNumber: number,
) {
  return (
    schedule?.entries.find(
      (entry) => entry.weekday === weekday && entry.periodNumber === periodNumber,
    ) ?? schedule?.entries.find((entry) => entry.periodNumber === periodNumber)
  );
}

/** The block in progress at `minutes` since midnight and the first one still to start; `blocks` must be sorted by start. */
export function findCurrentAndNext<T extends { startTime: string; endTime: string }>(
  blocks: readonly T[],
  minutes: number,
) {
  return {
    current:
      blocks.find(
        (block) => minutes >= clockMinutes(block.startTime) && minutes < clockMinutes(block.endTime),
      ) ?? null,
    next: blocks.find((block) => minutes < clockMinutes(block.startTime)) ?? null,
  };
}

export function getCurrentScheduleStatus(
  schedule: ScheduleEntryContainer | null,
  blocks: SchoolDayBlock[],
  now: Date = new Date(),
) {
  const weekday = getWeekdayForDate(now);
  if (!weekday) {
    return {
      weekday: null,
      currentBlock: null,
      currentEntry: null,
      nextBlock: null,
    };
  }

  const { current: currentBlock, next: nextBlock } = findCurrentAndNext(
    getBlocksForDay(blocks, weekday),
    now.getHours() * 60 + now.getMinutes(),
  );

  const currentEntry =
    currentBlock?.periodNumber != null
      ? findScheduleEntry(schedule, weekday, currentBlock.periodNumber)
      : null;

  return {
    weekday,
    currentBlock,
    currentEntry,
    nextBlock,
  };
}
