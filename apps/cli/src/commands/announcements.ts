import { api } from "../../../convex/src/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { PATHWAY_LABELS, isPathway } from "../../../shared/labels";
import { asId } from "../client/ids";
import { hostArgv } from "../client/host";
import { connect, mutation, query, refine, type Connection } from "../client/session";
import { CliError, usageError } from "../core/errors";
import { sanitizeRemoteText } from "../core/theme";
import type { CommandContext, CommandSpec, GroupSpec } from "../registry/types";
import { appendOption, readFileOrStdin } from "./input";
import { localTimestamp, parseDateInput, personName, preview } from "./format";
import { pathwayInput } from "./pathways";

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

const create: CommandSpec = {
  kind: "command",
  name: "create",
  summary: "Write an announcement",
  json: true,
  options: [
    { name: "title", type: "string", valueHint: "TEXT", description: "Headline" },
    { name: "body", type: "string", valueHint: "TEXT", description: "The announcement text" },
    { name: "body-file", type: "string", valueHint: "FILE", description: "Read the text from a file, or - for standard input" },
    { name: "grade", type: "string", valueHint: "N", description: "Only this grade; repeat for more", repeat: "append" },
    { name: "major", type: "string", valueHint: "PATHWAY", description: "Only this major pathway; repeat for more", repeat: "append" },
    { name: "minor", type: "string", valueHint: "PATHWAY", description: "Only this minor pathway; repeat for more", repeat: "append" },
    { name: "club", type: "string", valueHint: "ID", description: "Only this club" },
    { name: "comments", type: "boolean", description: "Let people comment" },
    { name: "general", type: "boolean", description: "Mark it as an administration notice" },
    { name: "promoted", type: "boolean", description: "Pin it at the top of the feed for 30 days" },
    { name: "expires", type: "string", valueHint: "DATE", description: "Last day it shows, as YYYY-MM-DD" },
  ],
  examples: [
    { description: "Announce something to the school", argv: ["announcements", "create", "--title", "Picture day", "--body", "Photos Thursday."] },
    { description: "Announce to one club", argv: ["announcements", "create", "--club", "<CLUB>", "--title", "Build", "--body", "Shop at 6."] },
  ],
  notes: [
    "Targets everyone unless --grade, --major, --minor, or --club narrows it. Club announcements from non-sponsors wait for a sponsor's approval.",
  ],
  async run(context) {
    const { out } = context;
    const title = typeof context.options.title === "string" ? context.options.title.trim() : "";
    if (!title) throw usageError("missing_title", "Pass --title.");
    const bodyOption = typeof context.options.body === "string" ? context.options.body : undefined;
    const bodyFile = typeof context.options["body-file"] === "string" ? context.options["body-file"] : undefined;
    if (!bodyOption && !bodyFile) throw usageError("missing_body", "Pass --body or --body-file.");
    if (bodyOption !== undefined && bodyFile !== undefined) {
      throw usageError("invalid_option", "Pass --body or --body-file, not both.");
    }
    const body = (bodyOption ?? (await readFileOrStdin(context, bodyFile!))).trim();
    if (!body) throw usageError("missing_body", "The announcement text is empty.");

    const grades = appendOption(context, "grade").map((value) => {
      const grade = Number(value);
      if (!Number.isInteger(grade) || grade < 9 || grade > 12) {
        throw usageError("invalid_grade", `--grade wants 9 through 12, not ${JSON.stringify(value)}.`);
      }
      return grade;
    });
    const majors = appendOption(context, "major").map((value) => pathwayInput(value, "--major"));
    const minors = appendOption(context, "minor").map((value) => pathwayInput(value, "--minor"));
    const club = typeof context.options.club === "string" ? context.options.club : undefined;
    if (club && (grades.length > 0 || majors.length > 0 || minors.length > 0)) {
      throw usageError("invalid_option", "--club targets one club, so leave out --grade, --major, and --minor.");
    }
    const targetType = club
      ? "CLUB"
      : (grades.length > 0 || majors.length > 0 || minors.length > 0) && grades.length > 0 && (majors.length > 0 || minors.length > 0)
        ? "INTERSECTION"
        : grades.length > 0
          ? "GRADE"
          : majors.length > 0 || minors.length > 0
            ? "PATHWAY"
            : "SCHOOL_WIDE";
    const expires = typeof context.options.expires === "string" ? context.options.expires : undefined;
    const expiresAt = expires ? new Date(`${parseDateInput(expires)}T23:59:59`).getTime() : undefined;

    const connection = await connect(context);
    let id;
    try {
      id = await mutation(connection, api.announcements.feed.create, {
        title,
        body,
        targetType,
        targetGrades: targetType === "GRADE" || targetType === "INTERSECTION" ? grades : [],
        targetMajorPathways: targetType === "PATHWAY" || targetType === "INTERSECTION" ? majors : [],
        targetMinorPathways: targetType === "PATHWAY" || targetType === "INTERSECTION" ? minors : [],
        ...(club ? { clubId: asId<"clubs">(club) } : {}),
        allowComments: context.options.comments === true,
        isAdminGeneral: context.options.general === true,
        promoted: context.options.promoted === true || undefined,
        ...(expiresAt === undefined ? {} : { expiresAt }),
      });
    } catch (error) {
      refine(error, [
        {
          match: /permission to create announcement drafts/,
          kind: "permission",
          reason: "announcement_not_allowed",
          message: "You can't write announcements for that audience.",
        },
      ]);
    }

    if (out.json) {
      out.document({ outcome: "created", announcement: { id, title: sanitizeRemoteText(title), targetType } });
      return;
    }
    out.success("Created", sanitizeRemoteText(title));
    out.identifier(id);
    if (club) out.text("If you aren't a sponsor, a sponsor has to approve it before anyone sees it.");
  },
};

const approve: CommandSpec = {
  kind: "command",
  name: "approve",
  summary: "Publish a club announcement waiting for approval",
  json: true,
  arguments: [{ name: "announcement", required: true, description: "Announcement ID from announcements list" }],
  examples: [{ description: "Approve one", argv: ["announcements", "approve", "<ANNOUNCEMENT>"] }],
  async run(context) {
    const { out } = context;
    const id = context.args[0]!;
    const connection = await connect(context);
    try {
      await mutation(connection, api.announcements.feed.approve, {
        announcementId: asId<"announcements">(id),
      });
    } catch (error) {
      announcementError(error, connection);
    }
    if (out.json) {
      out.document({ outcome: "approved", announcement: id });
      return;
    }
    out.success("Approved", id);
  },
};

const reject: CommandSpec = {
  kind: "command",
  name: "reject",
  summary: "Turn down a club announcement",
  json: true,
  arguments: [{ name: "announcement", required: true, description: "Announcement ID from announcements list" }],
  options: [{ name: "note", type: "string", valueHint: "TEXT", description: "Why, for the author" }],
  examples: [{ description: "Reject one", argv: ["announcements", "reject", "<ANNOUNCEMENT>", "--note", "Check the date."] }],
  async run(context) {
    const { out } = context;
    const id = context.args[0]!;
    const note = typeof context.options.note === "string" ? context.options.note : undefined;
    const connection = await connect(context);
    try {
      await mutation(connection, api.announcements.feed.reject, {
        announcementId: asId<"announcements">(id),
        ...(note ? { note } : {}),
      });
    } catch (error) {
      announcementError(error, connection);
    }
    if (out.json) {
      out.document({ outcome: "rejected", announcement: id });
      return;
    }
    out.success("Rejected", id);
  },
};

function announcementError(error: unknown, connection: Connection): never {
  refine(error, [
    {
      match: /Announcement not found/,
      kind: "not_found",
      reason: "announcement_not_found",
      message: "That announcement no longer exists.",
      next: [{ benefit: "See announcements", argv: ["announcements", "list", ...hostArgv(connection.host, connection.hostSource)] }],
    },
    {
      match: /no longer waiting for approval/,
      kind: "conflict",
      reason: "announcement_not_pending",
      message: "Someone already approved or rejected it.",
    },
    {
      match: /Unauthorized/,
      kind: "permission",
      reason: "approval_not_allowed",
      message: "You can't approve announcements for that club.",
    },
  ]);
}

export const announcementsGroup: GroupSpec = {
  kind: "group",
  name: "announcements",
  summary: "Read school and club announcements",
  section: "Community",
  children: [list, inspect, create, approve, reject],
};
