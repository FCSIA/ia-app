import { api } from "../../../convex/src/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { asId } from "../client/ids";
import { hostArgv } from "../client/host";
import { connect, mutation, query, refine, type Connection } from "../client/session";
import { confirmDestructive } from "../core/consent";
import { CliError } from "../core/errors";
import { sanitizeRemoteText } from "../core/theme";
import type { CommandContext, CommandSpec, GroupSpec } from "../registry/types";
import { limitOption } from "./announcements";
import { localTimestamp, personName } from "./format";

// The list returns the shared event shape; inspect adds approvals. Both satisfy
// this union, so one row function serves list and inspect.
type EventListItem = FunctionReturnType<typeof api.events.events.list>[number];
type EventDetail = NonNullable<FunctionReturnType<typeof api.events.events.get>>;

function row(event: EventListItem | EventDetail) {
  return {
    id: event._id,
    title: sanitizeRemoteText(event.title),
    startsAt: localTimestamp(event.startAt),
    endsAt: event.endAt ? localTimestamp(event.endAt) : null,
    location: event.location ? sanitizeRemoteText(event.location) : null,
    club: event.club ? sanitizeRemoteText(event.club.name) : null,
    status: event.status,
    description: event.description ? sanitizeRemoteText(event.description) : null,
    author: personName(event.author),
  };
}

function when(event: { startsAt: string; endsAt: string | null }) {
  if (!event.endsAt) return event.startsAt;
  const sameDay = event.endsAt.slice(0, 10) === event.startsAt.slice(0, 10);
  return `${event.startsAt}–${sameDay ? event.endsAt.slice(11) : event.endsAt}`;
}

function missing(id: string, connection: Connection) {
  return new CliError("not_found", "event_not_found", `No event visible to you has ID ${id}.`, {
    next: [{ benefit: "See the events you can see", argv: ["events", "list", ...hostArgv(connection.host, connection.hostSource)] }],
  });
}

const list: CommandSpec = {
  kind: "command",
  name: "list",
  summary: "List events",
  json: true,
  aliases: ["ls"],
  options: [
    { name: "all", type: "boolean", description: "Include events that already started" },
    {
      name: "limit",
      type: "string",
      valueHint: "N",
      description: "How many to show (default: 20)",
    },
  ],
  examples: [
    { description: "List upcoming events", argv: ["events", "list"] },
    { description: "Include past events", argv: ["events", "list", "--all"] },
  ],
  notes: ["School-wide and club events you can see are listed; approval-pending ones aren't."],
  async run(context) {
    const { out } = context;
    const connection = await connect(context);
    const events = (await query(connection, api.events.events.list, {})).map(row);
    const upcomingOnly = context.options.all !== true;
    const visible = upcomingOnly
      ? events.filter((event) => new Date(event.startsAt).getTime() >= Date.now())
      : events;
    const limit = limitOption(context, 20);
    const shown = visible.slice(0, limit);

    if (out.json) {
      out.document({ events: shown, total: visible.length, showing: shown.length });
      return;
    }
    if (shown.length === 0) {
      out.text(upcomingOnly ? "No upcoming events." : "No events.");
      return;
    }
    out.table(
      ["ID", "Starts", "Title", "Where", "Club"],
      shown.map((event) => [
        event.id,
        event.startsAt,
        event.title,
        event.location ?? "",
        event.club ?? "",
      ]),
    );
    if (visible.length > shown.length) {
      out.text(`Showing ${shown.length} of ${visible.length}. Use --limit to see more.`);
    }
  },
};

const inspect: CommandSpec = {
  kind: "command",
  name: "inspect",
  summary: "Show one event",
  json: true,
  aliases: ["show"],
  arguments: [{ name: "event", required: true, description: "Event ID from events list" }],
  examples: [{ description: "Show one event", argv: ["events", "inspect", "<EVENT>"] }],
  async run(context) {
    const { out } = context;
    const id = context.args[0]!;
    const connection = await connect(context);
    const event = await query(connection, api.events.events.get, { eventId: asId<"events">(id) });
    if (!event) throw missing(id, connection);
    const item = row(event);

    if (out.json) {
      out.document({ event: item });
      return;
    }

    out.detail([
      ["Title", item.title],
      ["When", when(item)],
      ["Where", item.location ?? "—"],
      ["Club", item.club ?? "School-wide"],
      ["Posted by", item.author ?? "—"],
      ["Status", item.status.toLowerCase().replace(/_/g, " ")],
    ]);
    if (item.description) {
      out.blank();
      out.print(item.description);
    }
  },
};

const cancel: CommandSpec = {
  kind: "command",
  name: "cancel",
  summary: "Cancel an event",
  json: true,
  arguments: [{ name: "event", required: true, description: "Event ID from events list" }],
  examples: [{ description: "Cancel one", argv: ["events", "cancel", "<EVENT>"] }],
  notes: ["Removes it from everyone's calendar and marks it cancelled."],
  async run(context) {
    const { out } = context;
    const id = context.args[0]!;
    const connection = await connect(context);
    const event = await query(connection, api.events.events.get, { eventId: asId<"events">(id) });
    if (!event) throw missing(id, connection);
    await confirmDestructive(context, {
      summary: `Cancel ${sanitizeRemoteText(event.title)}`,
      consequence: "This removes it from everyone's calendar and can't be undone.",
    });
    try {
      await mutation(connection, api.events.events.cancel, { eventId: event._id });
    } catch (error) {
      refine(error, [
        {
          match: /Event not found/,
          kind: "not_found",
          reason: "event_not_found",
          message: "That event no longer exists.",
          next: [{ benefit: "See events", argv: ["events", "list", ...hostArgv(connection.host, connection.hostSource)] }],
        },
        {
          match: /Cannot cancel this event/,
          kind: "permission",
          reason: "event_not_yours",
          message: "Only the author or an admin can cancel that event.",
        },
      ]);
    }

    if (out.json) {
      out.document({ outcome: "cancelled", event: id });
      return;
    }
    out.success("Cancelled", sanitizeRemoteText(event.title));
  },
};

export const eventsGroup: GroupSpec = {
  kind: "group",
  name: "events",
  summary: "See school and club events",
  section: "Community",
  children: [list, inspect, cancel],
};
