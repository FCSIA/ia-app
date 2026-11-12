import { api } from "../../../convex/src/_generated/api";
import { connect, query } from "../client/session";
import { CliError } from "../core/errors";
import { sanitizeRemoteText } from "../core/theme";
import type { CommandContext, CommandSpec, GroupSpec } from "../registry/types";
import { localTimestamp, preview } from "./format";
import { limitOption } from "./announcements";

const list: CommandSpec = {
  kind: "command",
  name: "list",
  summary: "List your notifications",
  json: true,
  aliases: ["ls"],
  options: [
    { name: "unread", type: "boolean", description: "Only notifications you haven't read" },
    {
      name: "limit",
      type: "string",
      valueHint: "N",
      description: "How many to show, up to 100 (default: 50)",
    },
  ],
  examples: [
    { description: "List your notifications", argv: ["notifications", "list"] },
    { description: "List unread ones", argv: ["notifications", "list", "--unread"] },
  ],
  async run(context) {
    const { out } = context;
    const connection = await connect(context);
    const limit = limitOption(context, 50);
    const notifications = (
      await query(connection, api.notifications.inbox.list, {
        unreadOnly: context.options.unread === true || undefined,
        limit,
      })
    ).map((notification) => ({
      id: notification.id,
      when: localTimestamp(notification.createdAt),
      read: notification.isRead,
      category: notification.category,
      title: sanitizeRemoteText(notification.title),
      body: sanitizeRemoteText(notification.body),
      link: sanitizeRemoteText(notification.href),
    }));

    if (out.json) {
      out.document({ notifications });
      return;
    }
    if (notifications.length === 0) {
      out.text(context.options.unread ? "No unread notifications." : "No notifications.");
      return;
    }
    out.table(
      ["ID", "When", "Read", "Title", "Notice"],
      notifications.map((notification) => [
        notification.id,
        notification.when,
        notification.read ? "yes" : "no",
        notification.title,
        preview(notification.body, 60),
      ]),
    );
  },
};

const read: CommandSpec = {
  kind: "command",
  name: "read",
  summary: "Open a notification on the web",
  json: true,
  arguments: [{ name: "notification", required: true, description: "Notification ID from notifications list" }],
  examples: [
    { description: "Get a notification's link", argv: ["notifications", "read", "<NOTIFICATION>"] },
  ],
  notes: [
    "Reading happens on the web; the CLI prints the link and leaves the unread state to the app.",
  ],
  async run(context) {
    const { out } = context;
    const id = context.args[0]!;
    const connection = await connect(context);
    const limit = limitOption(context, 100);
    const notifications = await query(connection, api.notifications.inbox.list, { limit });
    const notification = notifications.find((candidate) => candidate.id === id);
    if (!notification) {
      throw new CliError("not_found", "notification_not_found", `No notification on your account has ID ${id}.`, {
        next: [{ benefit: "See your notifications", argv: ["notifications", "list"] }],
      });
    }

    const link = new URL(sanitizeRemoteText(notification.href), connection.host).toString();
    if (out.json) {
      out.document({ notification: { id: notification.id, title: sanitizeRemoteText(notification.title), link } });
      return;
    }
    out.print(link);
    out.blank();
    out.row("Title", sanitizeRemoteText(notification.title));
    if (!notification.isRead) {
      out.text("Mark it read in the web app, where notifications live.");
    }
  },
};

export const notificationsGroup: GroupSpec = {
  kind: "group",
  name: "notifications",
  summary: "Read your notifications",
  section: "Your day",
  children: [list, read],
};
