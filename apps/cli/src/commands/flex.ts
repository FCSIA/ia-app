import { api } from "../../../convex/src/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { PATHWAY_LABELS, isPathway } from "../../../shared/labels";
import { connect, query } from "../client/session";
import { sanitizeRemoteText } from "../core/theme";
import type { CommandSpec, GroupSpec } from "../registry/types";
import { limitOption } from "./announcements";
import { localDate } from "./format";

type Friday = NonNullable<FunctionReturnType<typeof api.flexFriday.fridays.list>>[number];

const TYPE_LABELS: Record<Friday["type"], string> = {
  ALL_STUDENT: "All students",
  GRADE_SPECIFIC: "Grade specific",
  PATHWAY_SPECIFIC: "Pathway specific",
  TEACHER_PD: "Staff only",
};

const list: CommandSpec = {
  kind: "command",
  name: "list",
  summary: "List Flex Friday days",
  json: true,
  aliases: ["ls"],
  options: [
    {
      name: "limit",
      type: "string",
      valueHint: "N",
      description: "How many to show (default: 20)",
    },
  ],
  examples: [{ description: "List the latest Flex Fridays", argv: ["flex", "sessions", "list"] }],
  notes: [
    "A Flex Friday day owns workshops you can register for on the web or with flex registrations.",
  ],
  async run(context) {
    const { out } = context;
    const connection = await connect(context);
    const fridays = (await query(connection, api.flexFriday.fridays.list, {})).map((friday) => ({
      id: friday._id,
      date: localDate(friday.date),
      type: friday.type,
      typeLabel: TYPE_LABELS[friday.type],
      grade: friday.gradeLevel ? `Grade ${friday.gradeLevel}` : null,
      pathway:
        friday.pathway && isPathway(friday.pathway) ? PATHWAY_LABELS[friday.pathway] : friday.pathway ?? null,
      isSchoolDay: friday.isSchoolDay,
      sessions: friday._count.sessions,
      notes: friday.notes ? sanitizeRemoteText(friday.notes) : null,
    }));
    const limit = limitOption(context, 20);
    const shown = fridays.slice(0, limit);

    if (out.json) {
      out.document({ fridays: shown, total: fridays.length, showing: shown.length });
      return;
    }
    if (shown.length === 0) {
      out.text("No Flex Fridays yet.");
      return;
    }
    out.table(
      ["ID", "Date", "Type", "Sessions", "Notes"],
      shown.map((friday) => [
        friday.id,
        friday.date,
        friday.typeLabel,
        String(friday.sessions),
        friday.notes ?? "",
      ]),
    );
    if (fridays.length > shown.length) {
      out.text(`Showing ${shown.length} of ${fridays.length}. Use --limit to see more.`);
    }
  },
};

export const flexGroup: GroupSpec = {
  kind: "group",
  name: "flex",
  summary: "See Flex Friday days and your registrations",
  section: "Community",
  children: [
    {
      kind: "group",
      name: "sessions",
      summary: "See Flex Friday days",
      children: [list],
    },
  ],
};
