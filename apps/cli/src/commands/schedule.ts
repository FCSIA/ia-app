import { api } from "../../../convex/src/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { connect, query, type Connection } from "../client/session";
import { sanitizeRemoteText } from "../core/theme";
import type { CommandContext, CommandSpec, GroupSpec } from "../registry/types";
import { parseDateInput, todayDateKey } from "./format";

type Day = NonNullable<FunctionReturnType<typeof api.schedule.dashboard.getDay>>;

const KIND_LABELS: Record<Day["blocks"][number]["kind"], string> = {
  PERIOD: "Period",
  LUNCH: "Lunch",
  CUSTOM: "Custom",
};

function className(block: Day["blocks"][number]) {
  return block.entry ? sanitizeRemoteText(block.entry.className) : "";
}

function showDay(context: CommandContext, day: Day) {
  const { out } = context;
  if (out.json) {
    out.document({
      day: {
        dateKey: day.dateKey,
        weekday: day.weekday,
        name: sanitizeRemoteText(day.name),
        isSpecial: day.isSpecial,
        source: day.source,
        lunchPeriod: day.lunchPeriod,
        calendarSetupRequired: day.calendarSetupRequired,
        hasPersonalSchedule: day.hasPersonalSchedule,
      },
      blocks: day.blocks.map((block) => ({
        key: block.key,
        label: sanitizeRemoteText(block.label),
        displayLabel: sanitizeRemoteText(block.displayLabel),
        kind: block.kind,
        period: block.periodNumber,
        start: block.startTime,
        end: block.endTime,
        class: className(block),
      })),
      omittedPeriods: day.omittedPeriods,
    });
    return;
  }

  if (day.blocks.length === 0) {
    out.text(`No school day scheduled for ${day.dateKey}.`);
    return;
  }
  out.table(
    ["Time", "Block", "Class"],
    day.blocks.map((block) => [
      `${block.startTime}–${block.endTime}`,
      block.displayLabel,
      className(block) || KIND_LABELS[block.kind],
    ]),
  );

  out.blank();
  out.row("Date", `${day.dateKey} (${day.weekday ?? "no weekday"})`);
  out.row("Day", day.name);
  if (day.lunchPeriod) out.row("Lunch", `Period ${day.lunchPeriod}`);
  if (day.isSpecial) out.row("Schedule", "Special day");
  if (!day.hasPersonalSchedule) {
    out.text("You haven't set up your class schedule yet. Add your classes in the web app under Schedule.");
  }
}

async function dayFor(context: CommandContext, dateKey: string) {
  const connection: Connection = await connect(context);
  return query(connection, api.schedule.dashboard.getDay, { dateKey });
}

const today: CommandSpec = {
  kind: "command",
  name: "today",
  summary: "Show today's school day and your classes",
  section: "Your day",
  json: true,
  examples: [{ description: "Show today's schedule", argv: ["today"] }],
  notes: [
    "The day comes from the school calendar; special days and overrides are shown as they are.",
  ],
  async run(context) {
    showDay(context, await dayFor(context, todayDateKey()));
  },
};

const inspect: CommandSpec = {
  kind: "command",
  name: "inspect",
  summary: "Show a school day and your classes",
  json: true,
  aliases: ["show"],
  arguments: [
    { name: "date", required: false, description: "Date to show (default: today)" },
  ],
  examples: [
    { description: "Show today", argv: ["schedule", "inspect"] },
    { description: "Show a specific day", argv: ["schedule", "inspect", "2026-11-13"] },
    { description: "Show tomorrow", argv: ["schedule", "inspect", "tomorrow"] },
  ],
  async run(context: CommandContext) {
    const input = context.args[0] ?? "today";
    const dateKey = parseDateInput(input);
    showDay(context, await dayFor(context, dateKey));
  },
};

export const scheduleGroup: GroupSpec = {
  kind: "group",
  name: "schedule",
  summary: "Show school days and your classes",
  section: "Your day",
  children: [inspect],
};

export const todayCommand = today;
