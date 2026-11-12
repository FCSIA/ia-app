import { api } from "../../../convex/src/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { PATHWAY_LABELS, isPathway } from "../../../shared/labels";
import { asId } from "../client/ids";
import { hostArgv } from "../client/host";
import { connect, query, type Connection } from "../client/session";
import { CliError } from "../core/errors";
import { sanitizeRemoteText } from "../core/theme";
import type { CommandContext, CommandSpec, GroupSpec } from "../registry/types";
import { localTimestamp, personName, preview } from "./format";

type Announcement = NonNullable<FunctionReturnType<typeof api.announcements.feed.get>>["announcement"];

/** Who an announcement was published to, in the feed's own vocabulary. */
function audience(announcement: Announcement) {
  const parts: string[] = [];
  switch (announcement.targetType) {
    case "SCHOOL_WIDE":
      return "Everyone";
    case "GRADE":
      return announcement.targetGrades.map((grade) => `Grade ${grade}`).join(", ");
    case "PATHWAY":
      return announcement.targetPathway && isPathway(announcement.targetPathway)
        ? PATHWAY_LABELS[announcement.targetPathway]
        : "A pathway";
    case "CLUB":
      return announcement.club ? sanitizeRemoteText(announcement.club.name) : "A club";
    case "INTERSECTION":
      if (announcement.targetGrades.length > 0) {
        parts.push(...announcement.targetGrades.map((grade) => `Grade ${grade}`));
      }
      if (announcement.targetMajorPathways.length > 0) {
        parts.push(
          ...announcement.targetMajorPathways.map((pathway) =>
            isPathway(pathway) ? PATHWAY_LABELS[pathway] : pathway,
          ),
        );
      }
      if (announcement.club) parts.push(sanitizeRemoteText(announcement.club.name));
      return parts.length > 0 ? parts.join(" + ") : "A limited audience";
  }
}

function personLabel(person: { firstName: string; lastName: string; preferredName?: string | null } | null) {
  return personName(person) ?? "Former member";
}

function row(announcement: Announcement) {
  return {
    id: announcement._id,
    title: sanitizeRemoteText(announcement.title),
    author: personLabel(announcement.author),
    club: announcement.club ? sanitizeRemoteText(announcement.club.name) : null,
    audience: audience(announcement),
    body: sanitizeRemoteText(announcement.body),
    isRead: announcement.isRead,
    isPinned: announcement.isPinned,
    comments: announcement.commentCount,
    createdAt: announcement.createdAt,
  };
}

async function fetchList(connection: Connection, options: { unreadOnly: boolean }) {
  const announcements = await query(connection, api.announcements.feed.list, {
    unreadOnly: options.unreadOnly || undefined,
  });
  return announcements.map(row);
}

function missing(id: string, connection: Connection) {
  return new CliError("not_found", "announcement_not_found", `No announcement visible to you has ID ${id}.`, {
    next: [{ benefit: "See the announcements you can read", argv: ["announcements", "list", ...hostArgv(connection.host, connection.hostSource)] }],
  });
}

const list: CommandSpec = {
  kind: "command",
  name: "list",
  summary: "List announcements you can read",
  json: true,
  aliases: ["ls"],
  arguments: [],
  options: [
    { name: "unread", type: "boolean", description: "Only announcements you haven't read" },
    {
      name: "limit",
      type: "string",
      valueHint: "N",
      description: "How many to show (default: 20)",
    },
  ],
  examples: [
    { description: "List the latest announcements", argv: ["announcements", "list"] },
    { description: "List what you haven't read", argv: ["announcements", "list", "--unread"] },
  ],
  async run(context) {
    const { out } = context;
    const connection = await connect(context);
    const announcements = await fetchList(connection, {
      unreadOnly: context.options.unread === true,
    });
    const limit = limitOption(context, 20);
    const shown = announcements.slice(0, limit);

    if (out.json) {
      out.document({ announcements: shown, total: announcements.length, showing: shown.length });
      return;
    }
    if (shown.length === 0) {
      out.text(context.options.unread ? "No unread announcements." : "No announcements.");
      return;
    }
    out.table(
      ["ID", "Posted", "By", "To", "Title"],
      shown.map((item) => [
        item.id,
        localTimestamp(item.createdAt),
        item.author ?? "",
        item.club ?? item.audience,
        item.title,
      ]),
    );
    if (announcements.length > shown.length) {
      out.text(`Showing ${shown.length} of ${announcements.length}. Use --limit to see more.`);
    }
  },
};

export function limitOption(context: CommandContext, fallback: number) {
  const raw = context.options.limit;
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new CliError("usage", "invalid_option", `--limit wants a positive number, not ${JSON.stringify(String(raw))}.`);
  }
  return parsed;
}

const inspect: CommandSpec = {
  kind: "command",
  name: "inspect",
  summary: "Show one announcement and its comments",
  json: true,
  aliases: ["show"],
  arguments: [{ name: "announcement", required: true, description: "Announcement ID from announcements list" }],
  examples: [
    { description: "Read one announcement", argv: ["announcements", "inspect", "<ANNOUNCEMENT>"] },
  ],
  async run(context) {
    const { out } = context;
    const id = context.args[0]!;
    const connection = await connect(context);
    const found = await query(connection, api.announcements.feed.get, { announcementId: asId<"announcements">(id) });
    if (!found) throw missing(id, connection);
    const item = row(found.announcement);

    if (out.json) {
      out.document({
        announcement: item,
        comments: found.comments.map((comment) => ({
          id: comment._id,
          author: personLabel(comment.author),
          body: sanitizeRemoteText(comment.body),
          createdAt: comment.createdAt,
        })),
      });
      return;
    }

    out.detail([
      ["Title", item.title],
      ["By", item.author ?? "Unknown"],
      ["To", item.club ?? item.audience],
      ["Posted", localTimestamp(item.createdAt)],
      ["Comments", String(item.comments)],
    ]);
    out.blank();
    out.print(item.body);
    if (found.comments.length > 0) {
      out.print("");
      out.table(
        ["Commented", "By", "Comment"],
        found.comments.map((comment) => [
          localTimestamp(comment.createdAt),
          personLabel(comment.author),
          preview(comment.body),
        ]),
      );
    }
  },
};

export const announcementsGroup: GroupSpec = {
  kind: "group",
  name: "announcements",
  summary: "Read school and club announcements",
  section: "Community",
  children: [list, inspect],
};
