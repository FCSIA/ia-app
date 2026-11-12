import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/src/_generated/api";
import { auditActionLabel } from "../../../shared/audit";
import { asId } from "../client/ids";
import { hostArgv } from "../client/host";
import { connect, query, type Connection } from "../client/session";
import { CliError } from "../core/errors";
import type { CommandSpec, GroupSpec } from "../registry/types";
import { limitOption } from "./announcements";
import { localTimestamp, parseDateInput, personName } from "./format";

type AuditEvent = FunctionReturnType<typeof api.audit.events.list>[number];
type AuditDetail = NonNullable<FunctionReturnType<typeof api.audit.events.get>>;

function actorLabel(event: { actor: AuditEvent["actor"] }) {
  return personName(event.actor) ?? "System";
}

function row(event: AuditEvent) {
  return {
    id: event.id,
    action: event.action,
    actionLabel: auditActionLabel(event.action),
    entityType: event.entityType,
    entityId: event.entityId,
    actor: actorLabel(event),
    title: event.context.title,
    createdAt: event.createdAt,
    meta: event.meta,
  };
}

function detailRow(event: AuditDetail) {
  return {
    ...row(event),
    context: event.context,
    entityPreview: event.entityPreview,
  };
}

function str(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

const list: CommandSpec = {
  kind: "command",
  name: "list",
  summary: "Read the audit log",
  json: true,
  aliases: ["ls"],
  options: [
    { name: "query", type: "string", valueHint: "TEXT", description: "Search titles, people, and details" },
    { name: "action", type: "string", valueHint: "ACTION", description: "Only one action, such as user.deactivated" },
    { name: "actor", type: "string", valueHint: "TEXT", description: "Only one person's actions" },
    { name: "entity", type: "string", valueHint: "TYPE", description: "Only one entity type, such as user" },
    { name: "since", type: "string", valueHint: "DATE", description: "From this day, as YYYY-MM-DD" },
    { name: "until", type: "string", valueHint: "DATE", description: "Through this day, as YYYY-MM-DD" },
    { name: "limit", type: "string", valueHint: "N", description: "How many to show (default: 25)" },
  ],
  examples: [
    { description: "See recent changes", argv: ["audit", "list"] },
    { description: "See deactivations this month", argv: ["audit", "list", "--action", "user.deactivated", "--since", "2026-11-01"] },
  ],
  async run(context) {
    const { out } = context;
    const connection = await connect(context);
    const events = await query(connection, api.audit.events.list, {
      limit: limitOption(context, 25),
      ...(str(context.options.query) ? { query: str(context.options.query) } : {}),
      ...(str(context.options.action) ? { action: str(context.options.action) } : {}),
      ...(str(context.options.actor) ? { actor: str(context.options.actor) } : {}),
      ...(str(context.options.entity) ? { entityType: str(context.options.entity) } : {}),
      ...(str(context.options.since) ? { startDate: parseDateInput(str(context.options.since)!) } : {}),
      ...(str(context.options.until) ? { endDate: parseDateInput(str(context.options.until)!) } : {}),
    });
    const eventsOut = events.map(row);

    if (out.json) {
      out.document({ events: eventsOut });
      return;
    }
    if (eventsOut.length === 0) {
      out.text("No audit events match.");
      return;
    }
    out.table(
      ["ID", "When", "Who", "What", "Detail"],
      eventsOut.map((event) => [
        event.id,
        localTimestamp(event.createdAt),
        event.actor,
        event.actionLabel,
        event.title,
      ]),
    );
  },
};

const inspect: CommandSpec = {
  kind: "command",
  name: "inspect",
  summary: "Show one audit event",
  json: true,
  aliases: ["show"],
  arguments: [{ name: "event", required: true, description: "Audit event ID from audit list" }],
  examples: [{ description: "Show one event", argv: ["audit", "inspect", "<EVENT>"] }],
  async run(context) {
    const { out } = context;
    const id = context.args[0]!;
    const connection = await connect(context);
    const event = await query(connection, api.audit.events.get, {
      auditEventId: asId<"auditEvents">(id),
    });
    if (!event) {
      throw new CliError("not_found", "audit_event_not_found", `No audit event has ID ${id} that you can read.`, {
        next: [
          {
            benefit: "See recent events",
            argv: ["audit", "list", ...hostArgv(connection.host, connection.hostSource)],
          },
        ],
      });
    }
    const item = detailRow(event);

    if (out.json) {
      out.document({ event: item });
      return;
    }
    out.detail([
      ["What", item.actionLabel],
      ["When", localTimestamp(item.createdAt)],
      ["Who", item.actor],
      ["Entity", `${item.entityType}${item.entityId ? ` ${item.entityId}` : ""}`],
      ["Summary", item.title],
      ...(item.context.subtitle ? [["Details", item.context.subtitle] as [string, string]] : []),
    ]);
    if (item.meta) {
      out.blank();
      out.print(JSON.stringify(item.meta, null, 2));
    }
  },
};

export const auditGroup: GroupSpec = {
  kind: "group",
  name: "audit",
  summary: "Read who changed what",
  section: "Staff",
  children: [list, inspect],
};
