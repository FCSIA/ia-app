import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/src/_generated/api";
import {
  FEEDBACK_STATUSES,
  STAFF_FEEDBACK_STATUS_LABELS,
  type FeedbackStatus,
} from "../../../shared/feedback-status";
import { hostArgv } from "../client/host";
import { asId } from "../client/ids";
import { connect, mutation, query, type Connection } from "../client/session";
import { CliError, usageError } from "../core/errors";
import { sanitizeRemoteText } from "../core/theme";
import type { CommandSpec, GroupSpec } from "../registry/types";
import { limitOption } from "./announcements";
import { localTimestamp, personName, preview } from "./format";

type Feedback = FunctionReturnType<typeof api.moderation.reports.listFeedback>[number];

function statusLabel(status: string) {
  return STAFF_FEEDBACK_STATUS_LABELS[status as FeedbackStatus] ?? status;
}

function row(report: Feedback) {
  return {
    id: report._id,
    status: report.status,
    statusLabel: statusLabel(report.status),
    body: sanitizeRemoteText(report.reason),
    submitter: personName(report.submitter) ?? "Former member",
    createdAt: report.createdAt,
    appVersion: report.appVersion ?? null,
    githubIssue: report.githubIssueUrl ?? null,
    responses: report.responses.length,
  };
}

function missing(id: string, connection: Connection) {
  return new CliError("not_found", "feedback_not_found", `No feedback you can review has ID ${id}.`, {
    next: [
      {
        benefit: "See the feedback queue",
        argv: ["feedback", "list", ...hostArgv(connection.host, connection.hostSource)],
      },
    ],
  });
}

const list: CommandSpec = {
  kind: "command",
  name: "list",
  summary: "Read the feedback queue",
  json: true,
  aliases: ["ls"],
  options: [
    {
      name: "status",
      type: "string",
      valueHint: "STATUS",
      description: `Only ${FEEDBACK_STATUSES.join(", ").toLowerCase()}`,
    },
    { name: "limit", type: "string", valueHint: "N", description: "How many to show (default: 20)" },
  ],
  examples: [
    { description: "See new feedback", argv: ["feedback", "list", "--status", "PENDING"] },
    { description: "See everything", argv: ["feedback", "list", "--limit", "100"] },
  ],
  async run(context) {
    const { out } = context;
    const requested = typeof context.options.status === "string" ? context.options.status.toUpperCase() : undefined;
    if (requested && !(FEEDBACK_STATUSES as readonly string[]).includes(requested)) {
      throw usageError("invalid_status", `${requested} isn't a status. Use ${FEEDBACK_STATUSES.join(", ")}.`);
    }
    const connection = await connect(context);
    const reports = (await query(connection, api.moderation.reports.listFeedback, {}))
      .filter((report) => !requested || report.status === requested)
      .map(row);
    const limit = limitOption(context, 20);
    const shown = reports.slice(0, limit);

    if (out.json) {
      out.document({ feedback: shown, total: reports.length, showing: shown.length });
      return;
    }
    if (shown.length === 0) {
      out.text(requested ? `No ${statusLabel(requested).toLowerCase()} feedback.` : "No feedback.");
      return;
    }
    out.table(
      ["ID", "Received", "From", "Status", "Feedback"],
      shown.map((report) => [
        report.id,
        localTimestamp(report.createdAt),
        report.submitter,
        report.statusLabel,
        preview(report.body),
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
  summary: "Show one feedback report",
  json: true,
  aliases: ["show"],
  arguments: [{ name: "feedback", required: true, description: "Feedback ID from feedback list" }],
  examples: [{ description: "Read one", argv: ["feedback", "inspect", "<FEEDBACK>"] }],
  async run(context) {
    const { out } = context;
    const id = context.args[0]!;
    const connection = await connect(context);
    const report = await query(connection, api.moderation.reports.getFeedback, { reportId: id });
    if (!report) throw missing(id, connection);
    const item = row(report);

    if (out.json) {
      out.document({
        feedback: {
          ...item,
          reviewNote: report.reviewNote ?? null,
          reviewedAt: report.reviewedAt ?? null,
          responses: report.responses.map((response) => ({
            id: response._id,
            author: personName(response.author) ?? "Former staff",
            body: sanitizeRemoteText(response.body),
            createdAt: response.createdAt,
          })),
        },
      });
      return;
    }
    out.detail([
      ["From", item.submitter],
      ["Status", item.statusLabel],
      ["Received", localTimestamp(item.createdAt)],
      ["App", item.appVersion ?? ""],
      ...(item.githubIssue ? [["Issue", item.githubIssue] as [string, string]] : []),
    ]);
    out.blank();
    out.print(item.body);
    if (report.responses.length > 0) {
      out.blank();
      out.table(
        ["Replied", "By", "Response"],
        report.responses.map((response) => [
          localTimestamp(response.createdAt),
          personName(response.author) ?? "Former staff",
          sanitizeRemoteText(response.body),
        ]),
      );
    }
  },
};

const respond: CommandSpec = {
  kind: "command",
  name: "respond",
  summary: "Reply to feedback",
  json: true,
  arguments: [
    { name: "feedback", required: true, description: "Feedback ID from feedback list" },
    { name: "message", required: true, variadic: true, description: "Reply text" },
  ],
  examples: [
    {
      description: "Reply to feedback",
      argv: ["feedback", "respond", "<FEEDBACK>", "Thanks", "—", "this", "is", "fixed", "now."],
    },
  ],
  notes: ["The submitter sees the reply in their feedback history."],
  async run(context) {
    const { out } = context;
    const [id, ...words] = context.args;
    const body = words.join(" ").trim();
    if (!body) throw usageError("missing_message", "Write the reply after the feedback ID.");
    const connection = await connect(context);
    const report = await query(connection, api.moderation.reports.getFeedback, { reportId: id! });
    if (!report) throw missing(id!, connection);
    const responseId = await mutation(connection, api.moderation.reports.addFeedbackResponse, {
      reportId: asId<"moderationReports">(id!),
      body,
    });

    if (out.json) {
      out.document({ outcome: "responded", response: { id: responseId, feedback: id } });
      return;
    }
    out.success("Replied to", id!);
    out.identifier(responseId);
  },
};

export const feedbackGroup: GroupSpec = {
  kind: "group",
  name: "feedback",
  summary: "Review and answer what people send the school",
  section: "Staff",
  children: [list, inspect, respond],
};
