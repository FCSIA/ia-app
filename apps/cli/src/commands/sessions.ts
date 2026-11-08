import { api } from "../../../convex/src/_generated/api";
import { removeSignIn } from "../client/credentials";
import { hostArgv } from "../client/host";
import { connect, mutation, query, type Connection } from "../client/session";
import { CliError } from "../core/errors";
import { sanitizeRemoteText } from "../core/theme";
import type { CommandContext, CommandSpec, GroupSpec } from "../registry/types";

type SessionRow = Awaited<ReturnType<typeof listSessions>>[number];

async function listSessions(connection: Connection) {
  const sessions = await query(connection, api.users.cliSessions.list, {});
  return sessions.map((session) => ({
    id: session.id,
    client: sanitizeRemoteText(session.client),
    version: session.version,
    platform: session.platform,
    createdAt: new Date(session.createdAt).toISOString(),
    lastUsedAt: new Date(session.lastUsedAt).toISOString(),
    expiresAt: new Date(session.expiresAt).toISOString(),
    current: session.current,
  }));
}

// Local time without seconds: 2026-11-08 13:12.
export function localTimestamp(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const list: CommandSpec = {
  kind: "command",
  name: "list",
  summary: "List the CLI sign-ins on your account",
  json: true,
  aliases: ["ls"],
  examples: [{ description: "List CLI sign-ins", argv: ["sessions", "list"] }],
  notes: ["Lists sign-ins from the command-line client only. Web and app sign-ins aren't shown."],
  async run(context) {
    const { out } = context;
    const connection = await connect(context);
    const sessions = await listSessions(connection);
    if (out.json) {
      out.document({ sessions });
      return;
    }
    if (sessions.length === 0) {
      out.text("No CLI sign-ins.");
      return;
    }
    out.table(
      ["Session", "Client", "Signed in", "Last used"],
      sessions.map((session: SessionRow) => [
        session.id,
        session.current ? `${session.client} (this one)` : session.client,
        localTimestamp(session.createdAt),
        localTimestamp(session.lastUsedAt),
      ]),
    );
  },
};

const revoke: CommandSpec = {
  kind: "command",
  name: "revoke",
  summary: "Sign out a CLI sign-in",
  json: true,
  arguments: [{ name: "session", required: true, description: "Session ID from sessions list" }],
  examples: [
    { description: "Sign out a CLI sign-in", argv: ["sessions", "revoke", "<SESSION>"] },
  ],
  async run(context: CommandContext) {
    const { out } = context;
    const id = context.args[0]!;
    const connection = await connect(context);
    const sessions = await listSessions(connection);
    const session = sessions.find((candidate) => candidate.id === id);
    if (!session) {
      throw new CliError("not_found", "session_not_found", `No CLI sign-in on your account has ID ${id}.`, {
        next: [{ benefit: "See your CLI sign-ins", argv: ["sessions", "list", ...hostArgv(connection.host, connection.hostSource)] }],
      });
    }
    const result = await mutation(connection, api.users.cliSessions.revoke, { sessionId: id });

    // Revoking this CLI's own session signs it out, so drop the dead token.
    if (session.current && connection.credential.source !== "option" && connection.credential.source !== "environment") {
      await removeSignIn(context, connection.host);
    }

    if (out.json) {
      out.document({ outcome: result.outcome, session: { ...session, current: session.current } });
      return;
    }
    out.success(result.outcome === "revoked" ? "Signed out" : "Already signed out", session.client);
    if (session.current) out.text("That was this CLI, so you're now signed out here too.");
    out.identifier(id);
  },
};

export const sessionsGroup: GroupSpec = {
  kind: "group",
  name: "sessions",
  summary: "Review and sign out CLI sign-ins",
  section: "Account",
  children: [list, revoke],
};
