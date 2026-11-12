import { api } from "../../../convex/src/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { hostArgv } from "../client/host";
import { connect, query } from "../client/session";
import { asId } from "../client/ids";
import { CliError } from "../core/errors";
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
    const channelId = context.args[0]!;
    const found: Channel | null = await query(connection, api.clubs.channels.getById, {
      channelId: asId<"clubChannels">(channelId),
    });
    if (!found) {
      throw new CliError("not_found", "channel_not_found", `No readable channel has ID ${channelId}.`, {
        next: [{ benefit: "See your clubs", argv: ["clubs", "list", ...hostArgv(connection.host, connection.hostSource)] }],
      });
    }
    const limit = limitOption(context, 30);
    const page = await query(connection, api.clubs.channels.getMessagePage, {
      clubId: found.club._id,
      channelId: asId<"clubChannels">(channelId),
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

const messagesGroup: GroupSpec = {
  kind: "group",
  name: "messages",
  summary: "Read a club channel's messages",
  children: [messagesList],
};

export const clubsGroup: GroupSpec = {
  kind: "group",
  name: "clubs",
  summary: "See your clubs, their channels, and their messages",
  section: "Community",
  children: [list, inspect, channelsGroup, messagesGroup],
};
