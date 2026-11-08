import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/src/_generated/api";
import { displayName } from "../../../shared/user-name";
import {
  exchangeForJwt,
  formatUserCode,
  requestDeviceCode,
  signOutSession,
  waitForApproval,
} from "../client/auth";
import { loadCredential, removeSignIn, saveCredential } from "../client/credentials";
import { discover, hostArgv, resolveHost } from "../client/host";
import { connect, query } from "../client/session";
import { configDirectory, updateConfig, type SignedInUser } from "../core/config";
import { CliError } from "../core/errors";
import type { Runtime } from "../core/runtime";
import { sanitizeRemoteText } from "../core/theme";
import type { CommandContext, CommandSpec } from "../registry/types";

type Profile = NonNullable<FunctionReturnType<typeof api.users.me.me>>;

function settingsDirectory(context: CommandContext) {
  return configDirectory(context.runtime, context.globals.globalConfig);
}

function userSummary(profile: Profile) {
  return {
    id: profile._id as string,
    username: sanitizeRemoteText(profile.uniqueId),
    name: sanitizeRemoteText(displayName(profile)),
    roles: profile.roles as string[],
  };
}

function describeUser(user: { name: string; username: string }) {
  return user.name ? `${user.name} (${user.username})` : user.username;
}

// Opening a browser only helps someone sitting at this computer.
export function canOpenBrowser(runtime: Runtime) {
  const { env, platform } = runtime;
  if (env.SSH_CONNECTION || env.SSH_TTY || env.SSH_CLIENT) return false;
  if (platform === "darwin" || platform === "win32") return true;
  return Boolean(env.DISPLAY || env.WAYLAND_DISPLAY);
}

async function profileFor(runtime: Runtime, convexUrl: string, jwt: string) {
  const client = new ConvexHttpClient(convexUrl, { fetch: runtime.fetch, logger: false });
  client.setAuth(jwt);
  return client.query(api.users.me.me, {});
}

function rememberSignIn(context: CommandContext, host: string, user: SignedInUser, store: "keychain" | "file") {
  updateConfig(settingsDirectory(context), (config) => ({
    ...config,
    host,
    hosts: {
      ...config.hosts,
      [host]: { ...config.hosts?.[host], user, credentialStore: store, signedInAt: Date.now() },
    },
  }));
}


const login: CommandSpec = {
  kind: "command",
  name: "login",
  summary: "Sign in with your IA App account",
  section: "Account",
  json: true,
  options: [{ name: "browser", helpName: "no-browser", type: "boolean", description: "Don't open a browser" }],
  examples: [
    { description: "Sign in", argv: ["login"] },
    { description: "Sign in to a local development site", argv: ["login", "--host", "http://localhost:3000"] },
  ],
  notes: [
    "You approve the sign-in on the web, where you're already signed in. Approve only a code you started yourself.",
    "The CLI keeps the sign-in in your system's credential store and uses it until you run logout.",
  ],
  async run(context) {
    const { out, runtime } = context;
    const { host, source } = resolveHost(context);
    const discovery = await discover(context, host, { fresh: true });

    const existing = await loadCredential(context, host);
    if (existing && (existing.source === "keychain" || existing.source === "file")) {
      const jwt = await exchangeForJwt(runtime, discovery, existing.token);
      const profile = jwt ? await profileFor(runtime, discovery.convexUrl, jwt) : null;
      if (profile) {
        const user = userSummary(profile);
        if (out.json) {
          out.document({ outcome: "unchanged", host, user });
          return;
        }
        out.text(`Already signed in to ${host} as ${describeUser(user)}.`);
        out.blank();
        out.next({ benefit: "Sign in as someone else", argv: ["logout", ...hostArgv(host, source)] });
        return;
      }
    }

    const code = await requestDeviceCode(runtime, discovery);
    const minutes = Math.round(code.expiresIn / 60);
    if (out.json) {
      // A person has to act before this command can finish, even for an agent
      // that asked for JSON, so the code is announced as one line on stderr.
      runtime.stderr.write(
        `${JSON.stringify({
          status: "action_required",
          reason: "approval_required",
          message: `Open ${code.verificationUri} and confirm code ${formatUserCode(code.userCode)}.`,
          verificationUri: code.verificationUri,
          verificationUriComplete: code.verificationUriComplete,
          userCode: formatUserCode(code.userCode),
          expiresIn: code.expiresIn,
        })}\n`,
      );
    } else {
      out.text("To sign in, open this page and confirm the code:");
      out.blank();
      out.row("Page", code.verificationUri);
      out.row("Code", out.ui.bold(formatUserCode(code.userCode)));
      out.blank();
      const wantsBrowser = context.options.browser !== false;
      const opened =
        wantsBrowser && context.modes.interactive && canOpenBrowser(runtime)
          ? await runtime.openUrl(code.verificationUriComplete)
          : false;
      if (opened) out.text("Opened the page in your browser.");
      out.text(`Waiting for approval. The code expires in ${minutes} minutes.`);
    }

    const issued = await waitForApproval(runtime, discovery, code);
    const jwt = await exchangeForJwt(runtime, discovery, issued.token);
    const profile = jwt ? await profileFor(runtime, discovery.convexUrl, jwt) : null;
    if (!profile) {
      throw new CliError("authentication", "sign_in_failed", `${host} approved the sign-in but didn't accept the session.`, {
        retryable: true,
      });
    }
    const user = userSummary(profile);
    const store = await saveCredential(context, host, issued.token);
    rememberSignIn(context, host, { id: user.id, username: user.username, name: user.name }, store);

    if (store === "file" && runtime.env.FCSIA_CREDENTIAL_STORE !== "file") {
      out.warn({
        reason: "credential_store_unavailable",
        message: `No system credential store, so the sign-in is saved in ${settingsDirectory(context)} where only you can read it.`,
      });
    }
    if (runtime.env.FCSIA_TOKEN || context.globals.token) {
      out.warn({
        reason: "token_overrides_sign_in",
        message: `${context.globals.token ? "--token" : "FCSIA_TOKEN"} is set, so commands use that token instead of this sign-in.`,
      });
    }
    if (out.json) {
      out.document({ outcome: "signed_in", host, user, credentialStore: store });
      return;
    }
    out.blank();
    out.success("Signed in", describeUser(user));
    out.row("Site", host);
  },
};

const logout: CommandSpec = {
  kind: "command",
  name: "logout",
  summary: "Sign out and remove the saved sign-in",
  section: "Account",
  json: true,
  examples: [{ description: "Sign out", argv: ["logout"] }],
  async run(context) {
    const { out, runtime } = context;
    const { host } = resolveHost(context);
    const credential = await loadCredential(context, host);
    if (!credential) {
      if (out.json) out.document({ outcome: "unchanged", host });
      else out.text(`Not signed in to ${host}.`);
      return;
    }

    // End the session on the server first, so a saved token is never left
    // working after the local copy is gone. A server that can't be reached
    // doesn't stop the local sign-out; it's reported instead.
    let server: "ended" | "already_ended" | "unreachable";
    try {
      const discovery = await discover(context, host);
      server = (await signOutSession(runtime, discovery, credential.token)) ? "ended" : "already_ended";
    } catch (error) {
      if (!(error instanceof CliError) || error.kind === "canceled") throw error;
      server = "unreachable";
    }

    const saved = credential.source === "keychain" || credential.source === "file";
    const removed = saved ? await removeSignIn(context, host) : false;

    if (server === "unreachable") {
      out.warn({
        reason: "server_sign_out_failed",
        message: `Couldn't reach ${host}, so the session may stay active until it expires. Sign it out from your profile on the web.`,
      });
    }
    if (out.json) {
      out.document({ outcome: "signed_out", host, server, local: removed ? "removed" : "none" });
      return;
    }
    out.success("Signed out", host);
    out.row("Session", server === "ended" ? "Ended" : server === "already_ended" ? "Already ended" : "Not confirmed");
    out.row("Saved sign-in", removed ? "Removed" : "None");
  },
};

const whoami: CommandSpec = {
  kind: "command",
  name: "whoami",
  summary: "Show who you're signed in as",
  section: "Account",
  json: true,
  examples: [{ description: "Print your username", argv: ["whoami"] }],
  async run(context) {
    const { out } = context;
    const connection = await connect(context);
    const profile = await query(connection, api.users.me.me, {});
    if (!profile) {
      throw new CliError("authentication", "account_unavailable", "Your account is deactivated or no longer exists.");
    }
    const user = userSummary(profile);
    if (out.json) {
      out.document({ user, host: connection.host });
      return;
    }
    out.print(user.username);
    out.row("Name", user.name);
    out.row("Roles", user.roles.join(", ").toLowerCase().replace(/_/g, " "));
    out.row("Site", connection.host);
  },
};

export const accountCommands = [login, logout, whoami];
