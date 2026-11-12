import { api } from "../../../convex/src/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { PATHWAY_LABELS, isPathway } from "../../../shared/labels";
import { asId } from "../client/ids";
import { hostArgv } from "../client/host";
import { connect, mutation, query, type Connection } from "../client/session";
import { CliError } from "../core/errors";
import { sanitizeRemoteText } from "../core/theme";
import type { CommandSpec, GroupSpec } from "../registry/types";
import { limitOption } from "./announcements";
import { localDate } from "./format";

type Friday = NonNullable<FunctionReturnType<typeof api.flexFriday.fridays.list>>[number];
type Registration = FunctionReturnType<typeof api.flexFriday.registration.getMyRegistrations>[number];

const TYPE_LABELS: Record<Friday["type"], string> = {
  ALL_STUDENT: "All students",
  GRADE_SPECIFIC: "Grade specific",
  PATHWAY_SPECIFIC: "Pathway specific",
  TEACHER_PD: "Staff only",
};

function clean(title: string) {
  return sanitizeRemoteText(title);
}

async function fridayFor(connection: Connection, id: string) {
  const fridays = await query(connection, api.flexFriday.fridays.list, {});
  const friday = fridays.find((candidate) => candidate._id === id);
  if (!friday) {
    throw new CliError("not_found", "flex_not_found", `No Flex Friday has ID ${id}.`, {
      next: [{ benefit: "See the Flex Fridays", argv: ["flex", "sessions", "list", ...hostArgv(connection.host, connection.hostSource)] }],
    });
  }
  return friday;
}

const sessionsList: CommandSpec = {
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
    "A Flex Friday day owns sessions and workshops you can register for with flex registrations.",
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

const sessionsGroup: GroupSpec = {
  kind: "group",
  name: "sessions",
  summary: "See Flex Friday days",
  children: [sessionsList],
};

const workshopsList: CommandSpec = {
  kind: "command",
  name: "list",
  summary: "Browse the workshops on a Flex Friday",
  json: true,
  aliases: ["ls"],
  arguments: [{ name: "friday", required: true, description: "Flex Friday ID from flex sessions list" }],
  examples: [
    { description: "See a day's workshops", argv: ["flex", "workshops", "list", "<FRIDAY>"] },
  ],
  notes: ["Register for a workshop with flex registrations add."],
  async run(context) {
    const { out } = context;
    const id = context.args[0]!;
    const connection = await connect(context);
    const friday = await fridayFor(connection, id);
    const flexFridayId = asId<"flexFridays">(id);
    const sessions = await query(connection, api.flexFriday.sessions.listByFriday, {
      flexFridayId,
    });
    const groups = await Promise.all(
      sessions.map(async (session) => ({
        session,
        workshops: await query(connection, api.flexFriday.workshops.listBySession, {
          flexFridayId,
          sessionId: session._id,
        }),
      })),
    );

    if (out.json) {
      out.document({
        friday: { id: friday._id, date: localDate(friday.date), type: friday.type },
        sessions: groups.map(({ session, workshops }) => ({
          id: session._id,
          title: clean(session.title),
          start: session.startTime,
          end: session.endTime,
          workshops: workshops.map((workshop) => ({
            id: workshop._id,
            title: clean(workshop.title),
            location: workshop.location ? sanitizeRemoteText(workshop.location) : null,
            capacity: workshop.capacity ?? null,
            registrations: workshop._count.registrations,
            registered: workshop.registrations.length > 0,
            assigned: workshop.assignments.length > 0,
          })),
        })),
      });
      return;
    }

    const rows = groups.flatMap(({ session, workshops }) =>
      workshops.map((workshop) => [
        workshop._id,
        clean(session.title),
        `${session.startTime}–${session.endTime}`,
        clean(workshop.title),
        workshop.location ? sanitizeRemoteText(workshop.location) : "",
        workshop.registrations.length > 0
          ? "Registered"
          : workshop.assignments.length > 0
            ? "Assigned"
            : "",
      ]),
    );
    if (rows.length === 0) {
      out.text("No workshops on that Flex Friday yet.");
      return;
    }
    out.table(["ID", "Session", "Time", "Workshop", "Where", "Your spot"], rows);
    out.blank();
    out.row("Day", `${localDate(friday.date)} (${TYPE_LABELS[friday.type]})`);
  },
};

const workshopsGroup: GroupSpec = {
  kind: "group",
  name: "workshops",
  summary: "Browse a Flex Friday's workshops",
  children: [workshopsList],
};

function registrationRow(registration: Registration) {
  const workshop = registration.workshop;
  const session = workshop?.sessions[0]?.session;
  return {
    workshopId: registration.workshopId,
    workshop: workshop ? clean(workshop.title) : null,
    date: session?.flexFriday ? localDate(session.flexFriday.date) : null,
    time: session ? `${session.startTime}–${session.endTime}` : null,
    location: workshop?.location ? sanitizeRemoteText(workshop.location) : null,
  };
}

function registrationError(error: unknown, connection: Connection): never {
  if (error instanceof CliError && error.reason === "request_failed") {
    const next = [
      {
        benefit: "See your registrations",
        argv: ["flex", "registrations", "list", ...hostArgv(connection.host, connection.hostSource)],
      },
    ];
    if (/Already registered/.test(error.message)) {
      throw new CliError(
        "conflict",
        "already_registered",
        "You're already in a workshop for that session.",
        { next },
      );
    }
    if (/full capacity/.test(error.message)) {
      throw new CliError("limit", "workshop_full", "That workshop is full.", { next });
    }
    if (/Workshop not found/.test(error.message)) {
      throw new CliError("not_found", "workshop_not_found", "No workshop has that ID.", {
        next: [{ benefit: "Browse workshops", argv: ["flex", "workshops", "list", ...hostArgv(connection.host, connection.hostSource)] }],
      });
    }
    if (/Only students/.test(error.message)) {
      throw new CliError("permission", "students_only", "Only students register for workshops.");
    }
    if (/Registration not found/.test(error.message)) {
      throw new CliError("not_found", "registration_not_found", "You aren't registered for that workshop.", { next });
    }
  }
  throw error;
}

const registrationsList: CommandSpec = {
  kind: "command",
  name: "list",
  summary: "List the workshops you're registered for",
  json: true,
  aliases: ["ls"],
  examples: [{ description: "See your registrations", argv: ["flex", "registrations", "list"] }],
  async run(context) {
    const { out } = context;
    const connection = await connect(context);
    const registrations = (await query(connection, api.flexFriday.registration.getMyRegistrations, {})).map(
      registrationRow,
    );

    if (out.json) {
      out.document({ registrations });
      return;
    }
    if (registrations.length === 0) {
      out.text("You aren't registered for any workshops.");
      return;
    }
    out.table(
      ["Workshop ID", "Date", "Time", "Workshop", "Where"],
      registrations.map((registration) => [
        registration.workshopId,
        registration.date ?? "",
        registration.time ?? "",
        registration.workshop ?? "(removed workshop)",
        registration.location ?? "",
      ]),
    );
  },
};

const register: CommandSpec = {
  kind: "command",
  name: "add",
  summary: "Register for a Flex workshop",
  json: true,
  arguments: [{ name: "workshop", required: true, description: "Workshop ID from flex workshops list" }],
  examples: [
    { description: "Register for a workshop", argv: ["flex", "registrations", "add", "<WORKSHOP>"] },
  ],
  async run(context) {
    const { out } = context;
    const id = context.args[0]!;
    const connection = await connect(context);
    const workshopId = asId<"flexWorkshops">(id);
    try {
      await mutation(connection, api.flexFriday.registration.register, { workshopId });
    } catch (error) {
      registrationError(error, connection);
    }

    if (out.json) {
      out.document({ outcome: "registered", workshop: id });
      return;
    }
    out.success("Registered", id);
    out.identifier(id);
  },
};

const unregister: CommandSpec = {
  kind: "command",
  name: "remove",
  summary: "Drop a Flex workshop registration",
  json: true,
  aliases: ["rm"],
  arguments: [{ name: "workshop", required: true, description: "Workshop ID from flex registrations list" }],
  examples: [
    { description: "Drop a registration", argv: ["flex", "registrations", "remove", "<WORKSHOP>"] },
  ],
  async run(context) {
    const { out } = context;
    const id = context.args[0]!;
    const connection = await connect(context);
    const workshopId = asId<"flexWorkshops">(id);
    try {
      await mutation(connection, api.flexFriday.registration.unregister, { workshopId });
    } catch (error) {
      registrationError(error, connection);
    }

    if (out.json) {
      out.document({ outcome: "unregistered", workshop: id });
      return;
    }
    out.success("Removed", id);
    out.identifier(id);
  },
};

const registrationsGroup: GroupSpec = {
  kind: "group",
  name: "registrations",
  summary: "See and change your workshop registrations",
  children: [registrationsList, register, unregister],
};

export const flexGroup: GroupSpec = {
  kind: "group",
  name: "flex",
  summary: "See Flex Friday days, workshops, and your registrations",
  section: "Community",
  children: [sessionsGroup, workshopsGroup, registrationsGroup],
};
