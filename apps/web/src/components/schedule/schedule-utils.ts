import {
  ResolvedSchoolDay,
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

export function fullName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim();
}

export function parseTimeToMinutes(value: string) {
  const [hours, minutes] = value
    .split(":")
    .map((segment) => Number.parseInt(segment, 10));
  return hours * 60 + minutes;
}

export function formatScheduleTime(value: string) {
  const [hours, minutes] = value
    .split(":")
    .map((segment) => Number.parseInt(segment, 10));
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = ((hours + 11) % 12) + 1;
  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatScheduleTimeRange(start: string, end: string) {
  return `${formatScheduleTime(start)} – ${formatScheduleTime(end)}`;
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) return `${remainder}m`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
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
        parseTimeToMinutes(left.startTime) -
        parseTimeToMinutes(right.startTime),
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
  return schedule?.entries.find(
    (entry) => entry.weekday === weekday && entry.periodNumber === periodNumber,
  );
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

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const dayBlocks = getBlocksForDay(blocks, weekday);

  const currentBlock =
    dayBlocks.find(
      (block) =>
        currentMinutes >= parseTimeToMinutes(block.startTime) &&
        currentMinutes < parseTimeToMinutes(block.endTime),
    ) ?? null;

  const nextBlock =
    dayBlocks.find(
      (block) => currentMinutes < parseTimeToMinutes(block.startTime),
    ) ?? null;

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

export function getCurrentResolvedScheduleStatus(
  day: ResolvedSchoolDay | null | undefined,
  now: Date = new Date(),
) {
  if (!day) {
    return {
      currentBlock: null,
      currentEntry: null,
      nextBlock: null,
    };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentBlock =
    day.blocks.find(
      (block) =>
        currentMinutes >= parseTimeToMinutes(block.startTime) &&
        currentMinutes < parseTimeToMinutes(block.endTime),
    ) ?? null;
  const nextBlock =
    day.blocks.find(
      (block) => currentMinutes < parseTimeToMinutes(block.startTime),
    ) ?? null;

  return {
    currentBlock,
    currentEntry: currentBlock?.entry ?? null,
    nextBlock,
  };
}

export function copyDayEntries(
  entries: StudentScheduleDraftEntry[],
  sourceDay: ScheduleWeekday,
  targetDays: ScheduleWeekday[],
) {
  const sourceEntries = entries.filter((entry) => entry.weekday === sourceDay);
  const targetDaySet = new Set<ScheduleWeekday>(targetDays);
  const filtered = entries.filter((entry) => !targetDaySet.has(entry.weekday));

  return [
    ...filtered,
    ...targetDays.flatMap((weekday) =>
      sourceEntries.map((entry) => ({
        weekday,
        periodNumber: entry.periodNumber,
        courseId: entry.courseId,
        course: entry.course,
        className: entry.className,
      })),
    ),
  ];
}
