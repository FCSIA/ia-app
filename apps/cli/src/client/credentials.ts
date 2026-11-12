import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { configDirectory, updateConfig } from "../core/config";
import { CliError } from "../core/errors";
import type { CommandContext } from "../registry/types";

// Session tokens are kept in the system credential store (Keychain, Secret
// Service, Credential Manager), keyed by site. Where none is available they go
// in a file only the current user can read, next to the settings.

const SERVICE = "fcsia-cli";
const CREDENTIALS_FILE = "credentials.json";

export type CredentialSource = "option" | "environment" | "keychain" | "file";

export interface Credential {
  token: string;
  source: CredentialSource;
}

type CredentialFile = { tokens?: Record<string, string> };

function credentialsPath(context: CommandContext) {
  return join(configDirectory(context.runtime, context.globals.globalConfig), CREDENTIALS_FILE);
}

function readCredentialFile(path: string): CredentialFile {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new CliError("config", "invalid_config", `${path}: can't be read.`, { data: { path } });
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as CredentialFile;
  } catch {
    // Reported below with the file name.
  }
  throw new CliError("config", "invalid_config", `${path}: isn't a JSON object.`, { data: { path } });
}

function writeCredentialFile(path: string, contents: CredentialFile) {
  mkdirSync(join(path, ".."), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(contents, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

async function keychainGet(context: CommandContext, host: string) {
  try {
    return (await context.runtime.secrets?.get({ service: SERVICE, name: host })) ?? null;
  } catch {
    return null;
  }
}

// --token, then FCSIA_TOKEN, then the saved sign-in for this site.
export async function loadCredential(context: CommandContext, host: string): Promise<Credential | null> {
  if (context.globals.token) return { token: context.globals.token, source: "option" };
  const fromEnvironment = context.runtime.env.FCSIA_TOKEN;
  if (fromEnvironment) return { token: fromEnvironment, source: "environment" };
  const fromKeychain = await keychainGet(context, host);
  if (fromKeychain) return { token: fromKeychain, source: "keychain" };
  const fromFile = readCredentialFile(credentialsPath(context)).tokens?.[host];
  return fromFile ? { token: fromFile, source: "file" } : null;
}

export async function saveCredential(context: CommandContext, host: string, token: string) {
  const path = credentialsPath(context);
  const secrets = context.runtime.secrets;
  if (secrets) {
    try {
      await secrets.set({ service: SERVICE, name: host, value: token });
      removeFromFile(path, host);
      return "keychain" as const;
    } catch {
      // No usable credential store (a headless Linux box, for example).
    }
  }
  const contents = readCredentialFile(path);
  writeCredentialFile(path, { ...contents, tokens: { ...contents.tokens, [host]: token } });
  return "file" as const;
}

function removeFromFile(path: string, host: string) {
  const contents = readCredentialFile(path);
  if (!contents.tokens?.[host]) return false;
  const { [host]: _removed, ...tokens } = contents.tokens;
  writeCredentialFile(path, { ...contents, tokens });
  return true;
}

// Removes the saved token for a site from both places. Returns whether any
// token was removed.
export async function deleteCredential(context: CommandContext, host: string) {
  let removed = false;
  try {
    removed = (await context.runtime.secrets?.delete({ service: SERVICE, name: host })) ?? false;
  } catch {
    // Fall through to the file.
  }
  return removeFromFile(credentialsPath(context), host) || removed;
}

// Signs this computer out of a site: removes the saved token and who it
// belonged to. Returns whether a saved token was removed.
export async function removeSignIn(context: CommandContext, host: string) {
  const removed = await deleteCredential(context, host);
  updateConfig(configDirectory(context.runtime, context.globals.globalConfig), (config) => {
    const { user: _user, credentialStore: _store, signedInAt: _at, ...rest } = config.hosts?.[host] ?? {};
    const next = { ...config, hosts: { ...config.hosts, [host]: rest } };
    if (next.host === host) delete next.host;
    return next;
  });
  return removed;
}
