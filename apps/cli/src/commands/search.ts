import { api } from "../../../convex/src/_generated/api";
import { connect, query } from "../client/session";
import { sanitizeRemoteText } from "../core/theme";
import type { CommandSpec } from "../registry/types";

const search: CommandSpec = {
  kind: "command",
  name: "search",
  summary: "Find people and club channels",
  section: "Find",
  json: true,
  arguments: [
    { name: "query", required: true, variadic: true, description: "Words from a name or channel" },
  ],
  examples: [
    { description: "Find a person", argv: ["search", "ada"] },
    { description: "Find a channel", argv: ["search", "robotics builds"] },
  ],
  notes: [
    "People results respect the same visibility rules as the web: students find students in their grade.",
  ],
  async run(context) {
    const { out } = context;
    const text = context.args.join(" ").slice(0, 80);
    const connection = await connect(context);
    const results = await query(connection, api.search.global.palette, { search: text });

    const people = results.people.map((person) => ({
      id: person._id,
      kind: "person" as const,
      name: sanitizeRemoteText(
        person.preferredName ? `${person.preferredName} ${person.lastName}` : `${person.firstName} ${person.lastName}`,
      ),
      where: null,
    }));
    const channels = results.channels.map((channel) => ({
      id: channel._id,
      kind: "channel" as const,
      name: sanitizeRemoteText(channel.name),
      where: sanitizeRemoteText(channel.club.name),
      description: channel.description ? sanitizeRemoteText(channel.description) : null,
      visibility: channel.visibility,
    }));

    if (out.json) {
      out.document({ people, channels });
      return;
    }
    if (people.length === 0 && channels.length === 0) {
      out.text(`Nothing matches ${JSON.stringify(text)}.`);
      return;
    }
    out.table(
      ["Kind", "Match", "Where", "ID"],
      [
        ...people.map((person) => ["person", person.name, "", person.id]),
        ...channels.map((channel) => ["channel", channel.name, channel.where, channel.id]),
      ],
    );
  },
};

export const searchCommand = search;
