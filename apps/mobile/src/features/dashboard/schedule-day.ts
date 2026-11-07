import type { FunctionReturnType } from "convex/server";
import { format } from "date-fns";
import { api } from "~/apps/convex/src/_generated/api";
import { clockMinutes, currentSchoolWeekday, formatClockTime, SCHOOL_WEEKDAY_LABELS } from "~/apps/shared/school-time";

export type ScheduleDay = FunctionReturnType<typeof api.schedule.dashboard.getDay>;
export type ScheduleBlock = ScheduleDay["blocks"][number];

export type SchoolDayLabel = { value: string; label: string; isToday: boolean };

export function getDashboardSchoolDay(): SchoolDayLabel {
  const value = currentSchoolWeekday();
  const today = new Date().getDay();
  return { value, label: SCHOOL_WEEKDAY_LABELS[value], isToday: today >= 1 && today <= 5 };
}

/** The blocks to show: a custom "Lunch" block is dropped once the canonical lunch exists. */
export function resolvedDayBlocks(day: ScheduleDay) {
  const hasCanonicalLunch = day.blocks.some((block) => block.kind === "LUNCH");
  return day.blocks.filter(
    (block) =>
      !(
        hasCanonicalLunch &&
        block.kind === "CUSTOM" &&
        block.label.trim().toLowerCase() === "lunch"
      ),
  );
}

export function resolvedBlockTitle(block: ScheduleBlock) {
  if (block.kind === "LUNCH") return "Lunch";
  return block.entry?.className ?? block.displayLabel ?? block.label;
}

export function isCurrentBlock(
  block: { startTime: string; endTime: string } | undefined,
  isToday: boolean,
  now: Date = new Date(),
) {
  if (!block || !isToday) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= clockMinutes(block.startTime) && minutes < clockMinutes(block.endTime);
}

/** `day` is undefined until the schedule has loaded. */
export function getDashboardDayContext(
  day: ScheduleDay | undefined,
  schoolDay: SchoolDayLabel,
) {
  if (!day) return { blocks: [] as ScheduleBlock[], isToday: schoolDay.isToday, loaded: false };
  return {
    blocks: resolvedDayBlocks(day).sort((left, right) => left.position - right.position),
    isToday: day.dateKey === format(new Date(), "yyyy-MM-dd"),
    loaded: true,
  };
}

export function resolveSchoolDayStatus(
  day: ScheduleDay | undefined,
  schoolDay: SchoolDayLabel,
  now: Date = new Date(),
) {
  const dayContext = getDashboardDayContext(day, schoolDay);
  const dayBlocks = dayContext.blocks;
  const current = dayBlocks.find((block) => isCurrentBlock(block, dayContext.isToday, now));

  if (current) {
    return {
      title: resolvedBlockTitle(current),
      subtitle: "In progress",
      meta: `${formatClockTime(current.startTime)}–${formatClockTime(current.endTime)}`,
    };
  }

  const minutes = now.getHours() * 60 + now.getMinutes();
  const next = dayContext.isToday
    ? dayBlocks.find((block) => clockMinutes(block.startTime) > minutes)
    : dayBlocks[0];

  if (next) {
    return {
      title: resolvedBlockTitle(next),
      subtitle: dayContext.isToday ? "Next today" : `Next school day · ${schoolDay.label}`,
      meta: `${formatClockTime(next.startTime)}–${formatClockTime(next.endTime)}`,
    };
  }

  return {
    title: dayBlocks.length
      ? "School day complete"
      : dayContext.loaded
        ? "No school blocks today"
        : `No ${schoolDay.label} blocks`,
    subtitle: dayBlocks.length ? "No more scheduled blocks today." : "The school-day schedule is not configured.",
    meta: undefined,
  };
}

/** Pinned unread announcements first, then the rest of the unread feed. */
export function mergePinnedAnnouncements<Item extends { _id: string; isRead?: boolean }>(
  unread: Item[] | undefined,
  pinned: Item[],
) {
  if (!unread) return undefined;
  return [
    ...pinned.filter((item) => !item.isRead),
    ...unread.filter((item) => !pinned.some((pin) => pin._id === item._id)),
  ];
}
