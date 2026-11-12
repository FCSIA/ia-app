import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/src/_generated/api";
import { hostArgv } from "../client/host";
import { asId } from "../client/ids";
import { connect, mutation, query, refine, type Connection } from "../client/session";
import { CliError, usageError } from "../core/errors";
import { sanitizeRemoteText } from "../core/theme";
import type { CommandSpec, GroupSpec } from "../registry/types";
import { limitOption } from "./announcements";
import { localTimestamp, personName, preview } from "./format";

type Report = FunctionReturnType<typeof api.moderation.reports.list>[number];

const CONTENT_TYPE_LABELS: Record<string, string> = {
  ANNOUNCEMENT: "Announcement",
  EVENT: "Event",
  CLUB_CHANNEL_MESSAGE: "Club message",
};

// Reviews of content: resolving or dismissing is a decision, reopening undoes
// one. Unlike feedback, content reports are never put in review.
const STATUSES = ["PENDING", "RESOLVED", "DISMISSED"] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Open",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
};

function row(report: Report) {
  return {
    id: report._id,
    status: report.status,
    statusLabel: STATUS_LABELS[report.status] ?? report.status,
    contentType: report.contentType,
    contentLabel: CONTENT_TYPE_LABELS[report.contentType] ?? "Content",
    contentId: report.contentId,
    reason: sanitizeRemoteText(report.reason),
    reporter: personName(report.submitter) ?? "Former member",
    reportedUser: personName(report.reportedUser),
    club: report.club ? sanitizeRemoteText(report.club.name) : null,
    isEscalated: report.isEscalated,
    reviewNote: report.reviewNote ?? null,
    createdAt: report.createdAt,
  };
}

function missing(id: string, connection: Connection) {
  return new CliError("not_found", "report_not_found", `No report you can review has ID ${id}.`, {
    next: [
      {
        benefit: "See the report queue",
        argv: ["reports", "list", ...hostArgv(connection.host, connection.hostSource)],
      },
    ],
  });
}

function reportError(error: unknown, connection: Connection): never {
  refine(error, [
    {
      match: /Report not found/,
      kind: "not_found",
      reason: "report_not_found",
      message: "That report no longer exists.",
      next: [{ benefit: "See the report queue", argv: ["reports", "list", ...hostArgv(connection.host, connection.hostSource)] }],
    },
    {
      match: /updated by someone else/,
      kind: "conflict",
      reason: "report_changed",
      message: "Someone else reviewed it first. Check its latest status and try again.",
    },
    {
      match: /Only feedback can be marked in review/,
      kind: "usage",
      reason: "invalid_status",
      message: "Content reports can be resolved, dismissed, or reopened, but not marked in review.",
    },
  ]);
}

const list: CommandSpec = {
  kind: "command",
  name: "list",
  summary: "Read the content report queue",
  json: true,
  aliases: ["ls"],
  options: [
    {
      name: "status",
      type: "string",
      valueHint: "STATUS",
      description: `Only ${STATUSES.join(", ").toLowerCase()}`,
    },
    { name: "club", type: "string", valueHint: "ID", description: "Only reports about one club" },
    { name: "escalated", type: "boolean", description: "Only escalated reports" },
    { name: "limit", type: "string", valueHint: "N", description: "How many to show (default: 25)" },
  ],
  examples: [
    { description: "See open reports", argv: ["reports", "list", "--status", "pending"] },
    { description: "See what needs attention most", argv: ["reports", "list", "--escalated"] },
  ],
  async run(context) {
    const { out } = context;
    const requested = typeof context.options.status === "string" ? context.options.status.toUpperCase() : undefined;
    if (requested && !(STATUSES as readonly string[]).includes(requested)) {
      throw usageError("invalid_status", `${requested} isn't a status. Use ${STATUSES.join(", ")}.`);
    }
    const club = typeof context.options.club === "string" ? context.options.club : undefined;
    const connection = await connect(context);
    const reports = (
      await query(connection, api.moderation.reports.list, {
        ...(requested ? { status: requested as (typeof STATUSES)[number] } : {}),
        ...(club ? { clubId: asId<"clubs">(club) } : {}),
        ...(context.options.escalated === true ? { isEscalated: true } : {}),
      })
    ).map(row);
    const limit = limitOption(context, 25);
    const shown = reports.slice(0, limit);

    if (out.json) {
      out.document({ reports: shown, total: reports.length, showing: shown.length });
      return;
    }
    if (shown.length === 0) {
      out.text("No reports match.");
      return;
    }
    out.table(
      ["ID", "Reported", "Status", "About", "Reason"],
      shown.map((report) => [
        report.id,
        localTimestamp(report.createdAt),
        report.isEscalated ? `${report.statusLabel}, escalated` : report.statusLabel,
        `${report.contentLabel}${report.club ? ` in ${report.club}` : ""}`,
        preview(report.reason),
      ]),
    );
    if (reports.length > shown.length) {
      out.text(`Showing ${shown.length} of ${reports.length}. Use --limit to see more.`);
    }
  },
};

const inspect: CommandSpec = {
  kind: "command",
  name: "inspect",
  summary: "Show one report",
  json: true,
  aliases: ["show"],
  arguments: [{ name: "report", required: true, description: "Report ID from reports list" }],
  examples: [{ description: "Read one", argv: ["reports", "inspect", "<REPORT>"] }],
  async run(context) {
    const { out } = context;
    const id = context.args[0]!;
    const connection = await connect(context);
    // The list has no single-report query, and it is capped at the newest 200,
    // so an old report can be missing here even though it still exists.
    const reports = await query(connection, api.moderation.reports.list, {});
    const report = reports.find((candidate) => candidate._id === id);
    if (!report) throw missing(id, connection);
    const item = row(report);

    if (out.json) {
      out.document({ report: item });
      return;
    }
    out.detail([
      ["About", `${item.contentLabel}${item.club ? ` in ${item.club}` : ""}`],
      ["Status", item.isEscalated ? `${item.statusLabel}, escalated` : item.statusLabel],
      ["Reported", localTimestamp(item.createdAt)],
      ["Reported by", item.reporter],
      ["About person", item.reportedUser ?? ""],
      ["Content ID", item.contentId],
      ...(item.reviewNote ? [["Review note", sanitizeRemoteText(item.reviewNote)] as [string, string]] : []),
    ]);
    out.blank();
    out.print(item.reason);
  },
};

const update: CommandSpec = {
  kind: "command",
  name: "update",
  summary: "Resolve, dismiss, or reopen a report",
  json: true,
  arguments: [{ name: "report", required: true, description: "Report ID from reports list" }],
  options: [
    { name: "status", type: "string", valueHint: "STATUS", description: `One of ${STATUSES.join(", ")}` },
    { name: "note", type: "string", valueHint: "TEXT", description: "Why, for other staff" },
  ],
  examples: [
    { description: "Resolve a report", argv: ["reports", "update", "<REPORT>", "--status", "RESOLVED"] },
    { description: "Reopen one", argv: ["reports", "update", "<REPORT>", "--status", "PENDING"] },
  ],
  notes: ["The update fails if someone else reviewed the report first, so nothing is overwritten."],
  async run(context) {
    const { out } = context;
    const id = context.args[0]!;
    const requested = typeof context.options.status === "string" ? context.options.status.toUpperCase() : undefined;
    if (!requested) throw usageError("missing_status", "Pass --status with the new status.");
    if (!(STATUSES as readonly string[]).includes(requested)) {
      throw usageError("invalid_status", `${requested} isn't a status. Use ${STATUSES.join(", ")}.`);
    }
    const note = typeof context.options.note === "string" ? context.options.note : "";
    const connection = await connect(context);
    const reports = await query(connection, api.moderation.reports.list, {});
    const report = reports.find((candidate) => candidate._id === id);
    if (!report) throw missing(id, connection);
    try {
      await mutation(connection, api.moderation.reports.update, {
        reportId: report._id,
        status: requested as (typeof STATUSES)[number],
        reviewNote: note,
        expectedStatus: report.status,
      });
    } catch (error) {
      reportError(error, connection);
    }

    if (out.json) {
      out.document({ outcome: "updated", report: { id, status: requested } });
      return;
    }
    out.success(STATUS_LABELS[requested] ?? requested, id);
  },
};

export const moderationGroup: GroupSpec = {
  kind: "group",
  name: "reports",
  summary: "Review reports about content and messages",
  section: "Staff",
  children: [list, inspect, update],
};
