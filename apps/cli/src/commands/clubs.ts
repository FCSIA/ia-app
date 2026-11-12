import { api } from "../../../convex/src/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../../convex/src/_generated/dataModel";
import { hostArgv } from "../client/host";
import { asId } from "../client/ids";
import { watch } from "../client/live";
import { connect, mutation, query, translateError, type Connection } from "../client/session";
import { CliError, usageError } from "../core/errors";
import { sanitizeRemoteText } from "../core/theme";
import type { CommandContext, CommandSpec, GroupSpec } from "../registry/types";
import { limitOption } from "./announcements";
import { localTimestamp, preview } from "./format";

type ClubSummary = FunctionReturnType<typeof api.clubs.management.getMyClubs>["clubs"][number];
type ClubDetail = NonNullable<FunctionReturnType<typeof api.clubs.detail.get>>;
type Channel = NonNullable<FunctionReturnType<typeof api.clubs.channels.getById>>;
type Message = NonNullable<FunctionReturnType<typeof api.clubs.channels.getMessagePage>>["page"][number];

function personName(person: { firstName: string; lastName: string; preferredName?: string | null }) {
  const name = person.preferredName
    ? `${person.preferredName} ${person.lastName}`
    : `${person.firstName} ${person.lastName}`;
  return sanitizeRemoteText(name);
}

const list: CommandSpec = {
  kind: "command",
  name: "list",
  summary: "List your clubs",
  json: true,
  aliases: ["ls"],
  examples: [{ description: "List the clubs you belong to", argv: ["clubs", "list"] }],
  async run(context) {
    const { out } = context;
    const connection = await connect(context);
    const mine = await query(connection, api.clubs.management.getMyClubs, {});
    const clubs = mine.clubs.map((club: ClubSummary) => ({
      id: club._id,
      name: sanitizeRemoteText(club.name),
      description: club.description ? sanitizeRemoteText(club.description) : null,
      role: club.role ? sanitizeRemoteText(club.role) : null,
      members: club._count.members,
      channels: club._count.channels,
      unreadChannels: club.unreadChannels,
    }));

    if (out.json) {
      out.document({ clubs });
      return;
    }
    if (clubs.length === 0) {
      out.text("You aren't in any clubs yet. Discover them on the web under Clubs.");
      return;
    }
    out.table(
      ["ID", "Name", "Your role", "Members", "Unread"],
      clubs.map((club) => [
        club.id,
        club.name,
        club.role ?? "Member",
        String(club.members),
        club.unreadChannels ? String(club.unreadChannels) : "",
      ]),
    );
  },
};

const inspect: CommandSpec = {
  kind: "command",
  name: "inspect",
  summary: "Show one club",
  json: true,
  aliases: ["show"],
  arguments: [{ name: "club", required: true, description: "Club ID from clubs list" }],
  examples: [{ description: "Show one club", argv: ["clubs", "inspect", "<CLUB>"] }],
  async run(context) {
    const { out } = context;
    const id = context.args[0]!;
    const connection = await connect(context);
    const club: ClubDetail | null = await query(connection, api.clubs.detail.get, {
      clubId: asId<"clubs">(id),
    });
    if (!club) {
      throw new CliError("not_found", "club_not_found", `No club visible to you has ID ${id}.`, {
        next: [{ benefit: "See your clubs", argv: ["clubs", "list", ...hostArgv(connection.host, connection.hostSource)] }],
      });
    }

    const leaders = club.leaders.map((leader) => personName(leader.user));
    const sponsors = club.sponsors.map((sponsor) => personName(sponsor.user));
    if (out.json) {
      out.document({
        club: {
          id: club._id,
          name: sanitizeRemoteText(club.name),
          description: club.description ? sanitizeRemoteText(club.description) : null,
          overview: club.overview ? sanitizeRemoteText(club.overview) : null,
          members: club._count.members,
          channels: club._count.channels,
          leaders,
          sponsors,
          tags: club.tags.map((tag) => sanitizeRemoteText(tag.name)),
          myRole: club.role ? sanitizeRemoteText(club.role) : null,
          viewer: {
            isMember: club.viewer.isMember,
            isSponsor: club.viewer.isSponsor,
            isAdmin: club.viewer.isAdmin,
            hasPendingJoinRequest: club.viewer.hasPendingJoinRequest,
          },
        },
      });
      return;
    }

    out.detail([
      ["Name", sanitizeRemoteText(club.name)],
      ["Members", String(club._count.members)],
      ["Your role", club.role ? sanitizeRemoteText(club.role) : club.viewer.isMember ? "Member" : "Not a member"],
      ["Leaders", leaders.length > 0 ? leaders.join(", ") : "—"],
      ["Sponsors", sponsors.length > 0 ? sponsors.join(", ") : "—"],
      ["Channels", String(club._count.channels)],
      ...(club.tags.length > 0 ? ([["Tags", club.tags.map((tag) => sanitizeRemoteText(tag.name)).join(", ")]] as [string, string][]) : []),
    ]);
    const about = club.overview ?? club.description;
    if (about) {
      out.blank();
      out.print(sanitizeRemoteText(about));
    }
    if (!club.viewer.isMember && !club.viewer.hasPendingJoinRequest) {
      out.blank();
      out.text("Join this club on the web under Clubs.");
    }
  },
};

const channelsList: CommandSpec = {
  kind: "command",
  name: "list",
  summary: "List a club's channels",
  json: true,
  aliases: ["ls"],
  arguments: [{ name: "club", required: true, description: "Club ID from clubs list" }],
  examples: [
    { description: "List a club's channels", argv: ["clubs", "channels", "list", "<CLUB>"] },
  ],
  async run(context: CommandContext) {
    const { out } = context;
    const connection = await connect(context);
    const clubId = context.args[0]!;
    const channels = await query(connection, api.clubs.channels.list, {
      clubId: asId<"clubs">(clubId),
    });
    if (out.json) {
      out.document({
        channels: channels.map((channel) => ({
          id: channel._id,
          name: sanitizeRemoteText(channel.name),
          description: channel.description ? sanitizeRemoteText(channel.description) : null,
          visibility: channel.visibility,
        })),
      });
      return;
    }
    if (channels.length === 0) {
      out.text("No channels you can read in this club.");
      return;
    }
    out.table(
      ["ID", "Name", "Visibility", "About"],
      channels.map((channel) => [
        channel._id,
        sanitizeRemoteText(channel.name),
        channel.visibility.toLowerCase().replace(/_/g, " "),
        channel.description ? preview(channel.description, 50) : "",
      ]),
    );
  },
};

const channelsGroup: GroupSpec = {
  kind: "group",
  name: "channels",
  summary: "See a club's channels",
  children: [channelsList],
};

function messageRow(message: Message) {
  return {
    id: message._id,
    when: localTimestamp(message.createdAt),
    author: personName(message.author),
    body: message.isDeleted ? "(deleted)" : sanitizeRemoteText(message.body),
    replies: message.replyCount,
    reactions: message.reactions.reduce((total, reaction) => total + reaction.count, 0),
  };
}

async function resolveChannel(connection: Connection, channelId: Id<"clubChannels">) {
  return query(connection, api.clubs.channels.getById, { channelId });
}

function channelNotFound(id: string, connection: Connection) {
  return new CliError("not_found", "channel_not_found", `No readable channel has ID ${id}.`, {
    next: [{ benefit: "See your clubs", argv: ["clubs", "list", ...hostArgv(connection.host, connection.hostSource)] }],
  });
}

const messagesList: CommandSpec = {
  kind: "command",
  name: "list",
  summary: "Read a channel's messages",
  json: true,
  aliases: ["ls"],
  arguments: [{ name: "channel", required: true, description: "Channel ID from clubs channels list" }],
  options: [
    {
      name: "limit",
      type: "string",
      valueHint: "N",
      description: "How many, up to 40 (default: 30)",
    },
  ],
  examples: [
    { description: "Read a channel", argv: ["clubs", "messages", "list", "<CHANNEL>"] },
  ],
  notes: [
    "Only top-level messages are shown, newest first; replies and reactions stay in the web app.",
  ],
  async run(context: CommandContext) {
    const { out } = context;
    const connection = await connect(context);
    const channelId = asId<"clubChannels">(context.args[0]!);
    const found: Channel | null = await resolveChannel(connection, channelId);
    if (!found) throw channelNotFound(context.args[0]!, connection);
    const limit = limitOption(context, 30);
    const page = await query(connection, api.clubs.channels.getMessagePage, {
      clubId: found.club._id,
      channelId,
      paginationOpts: { numItems: limit, cursor: null },
    });
    const messages = page.page.map(messageRow);

    if (out.json) {
      out.document({
        channel: {
          id: found.channel._id,
          name: sanitizeRemoteText(found.channel.name),
          club: { id: found.club._id, name: sanitizeRemoteText(found.club.name) },
        },
        messages,
        isDone: page.isDone,
        continueCursor: page.continueCursor || undefined,
      });
      return;
    }
    out.text(`#${sanitizeRemoteText(found.channel.name)} in ${sanitizeRemoteText(found.club.name)}`);
    if (messages.length === 0) {
      out.text("No messages yet.");
      return;
    }
    out.table(
      ["ID", "When", "Author", "Message"],
      messages.map((message) => [message.id, message.when, message.author, preview(message.body, 60)]),
    );
    if (!page.isDone) {
      out.text("Older messages remain; they're on the web.");
    }
  },
};

const send: CommandSpec = {
  kind: "command",
  name: "send",
  summary: "Send a message to a club channel",
  json: true,
  arguments: [
    { name: "channel", required: true, description: "Channel ID from clubs channels list" },
    { name: "message", required: true, variadic: true, description: "Message text" },
  ],
  examples: [
    {
      description: "Send a message",
      argv: ["clubs", "messages", "send", "<CHANNEL>", "Build", "night", "is", "moved", "to", "the", "shop."],
    },
  ],
  notes: ["Sends plain text. Formatting, mentions, attachments, and replies stay in the web app."],
  async run(context) {
    const { out } = context;
    const [channelRef, ...words] = context.args;
    const body = words.join(" ").trim();
    if (!body) throw usageError("missing_message", "Write the message text after the channel ID.");
    const channelId = asId<"clubChannels">(channelRef!);
    const connection = await connect(context);
    const found: Channel | null = await resolveChannel(connection, channelId);
    if (!found) throw channelNotFound(channelRef!, connection);
    const messageId = await mutation(connection, api.clubs.channels.postMessage, { channelId, body });

    if (out.json) {
      out.document({
        outcome: "sent",
        message: {
          id: messageId,
          channel: { id: found.channel._id, name: sanitizeRemoteText(found.channel.name) },
        },
      });
      return;
    }
    out.success("Sent", `#${sanitizeRemoteText(found.channel.name)}`);
    out.identifier(messageId);
  },
};

const follow: CommandSpec = {
  kind: "command",
  name: "follow",
  summary: "Watch a club channel for new messages",
  json: true,
  arguments: [{ name: "channel", required: true, description: "Channel ID from clubs channels list" }],
  examples: [
    { description: "Watch a channel", argv: ["clubs", "messages", "follow", "<CHANNEL>"] },
  ],
  notes: [
    "Shows the latest messages, then each new one until you press Ctrl-C. With --json, each message is its own document.",
  ],
  async run(context) {
    const { out } = context;
    const connection = await connect(context);
    const channelId = asId<"clubChannels">(context.args[0]!);
    const found: Channel | null = await resolveChannel(connection, channelId);
    if (!found) throw channelNotFound(context.args[0]!, connection);
    const page = await query(connection, api.clubs.channels.getMessagePage, {
      clubId: found.club._id,
      channelId,
      paginationOpts: { numItems: 30, cursor: null },
    });

    const seen = new Set<Message["_id"]>();
    const show = (message: Message) => {
      seen.add(message._id);
      const row = messageRow(message);
      if (out.json) {
        out.document({ message: row });
        return;
      }
      out.print(`${row.when}  ${row.author}  ${row.body}`);
    };

    if (out.json) {
      out.document({
        channel: {
          id: found.channel._id,
          name: sanitizeRemoteText(found.channel.name),
          club: { id: found.club._id, name: sanitizeRemoteText(found.club.name) },
        },
        messages: [...page.page].reverse().map(messageRow),
      });
      for (const message of page.page) seen.add(message._id);
    } else {
      out.text(
        `Watching #${sanitizeRemoteText(found.channel.name)} in ${sanitizeRemoteText(found.club.name)}. Press Ctrl-C to stop.`,
      );
      for (const message of [...page.page].reverse()) show(message);
    }

    let failure: CliError | null = null;
    let finish = () => {};
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const stop = () => finish();
    context.runtime.signal.addEventListener("abort", stop, { once: true });
    const watcher = watch(
      context.runtime,
      connection,
      api.clubs.channels.getMessagePage,
      { clubId: found.club._id, channelId, paginationOpts: { numItems: 30, cursor: null } },
      (next) => {
        for (const message of [...next.page].reverse()) {
          if (!seen.has(message._id)) show(message);
        }
      },
      (error) => {
        failure = translateError(connection, error, "query");
        finish();
      },
    );
    await finished;
    context.runtime.signal.removeEventListener("abort", stop);
    await watcher.close();
    if (failure) throw failure;
  },
};

const messagesGroup: GroupSpec = {
  kind: "group",
  name: "messages",
  summary: "Read, send, and watch a club channel's messages",
  children: [messagesList, send, follow],
};

export const clubsGroup: GroupSpec = {
  kind: "group",
  name: "clubs",
  summary: "See your clubs, their channels, and their messages",
  section: "Community",
  children: [list, inspect, channelsGroup, messagesGroup],
};
