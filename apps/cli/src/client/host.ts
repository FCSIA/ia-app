import { CLI_DISCOVERY_PATH, type CliDiscoveryDocument } from "../../../shared/cli";
import { configDirectory, readConfig, updateConfig } from "../core/config";
import { CliError, usageError } from "../core/errors";
import { cliVersion } from "../core/runtime";
import type { CommandContext } from "../registry/types";
import { field, requestJson, textField } from "./http";

export const DEFAULT_HOST = "https://app.fcsia.com";
const DISCOVERY_TTL_MS = 60 * 60 * 1000;

export type HostSource = "option" | "environment" | "saved" | "default";

function isLoopback(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

// A site is its origin. People may type `app.fcsia.com`; plain http is only
// accepted for a site on this computer.
export function normalizeHost(value: string) {
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw usageError("invalid_host", `${value} isn't a web address.`);
  }
  if (url.protocol === "https:" || (url.protocol === "http:" && isLoopback(url.hostname))) {
    return url.origin;
  }
  throw usageError("invalid_host", `${value} must start with https://.`);
}

// --host, then FCSIA_HOST, then the site saved at sign-in, then the default.
export function resolveHost(context: CommandContext): { host: string; source: HostSource } {
  if (context.globals.host) return { host: normalizeHost(context.globals.host), source: "option" };
  const fromEnvironment = context.runtime.env.FCSIA_HOST;
  if (fromEnvironment) return { host: normalizeHost(fromEnvironment), source: "environment" };
  const saved = readConfig(configDirectory(context.runtime, context.globals.globalConfig)).host;
  if (saved) return { host: normalizeHost(saved), source: "saved" };
  return { host: DEFAULT_HOST, source: "default" };
}

// Arguments that select the same site in a suggested command.
export function hostArgv(host: string, source: HostSource) {
  return source === "option" ? ["--host", host] : [];
}

function parseVersion(version: string) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  return match ? match.slice(1, 4).map(Number) : null;
}

export function isOlderVersion(version: string, minimum: string) {
  const left = parseVersion(version);
  const right = parseVersion(minimum);
  if (!left || !right) return false;
  for (let index = 0; index < 3; index += 1) {
    if (left[index]! !== right[index]!) return left[index]! < right[index]!;
  }
  return false;
}

function asDiscovery(body: unknown): CliDiscoveryDocument | null {
  const convexUrl = textField(body, "convexUrl");
  const convexSiteUrl = textField(body, "convexSiteUrl");
  const appVersion = textField(body, "appVersion");
  const minCliVersion = textField(body, "minCliVersion");
  if (field(body, "service") !== "fcsia" || !convexUrl || !convexSiteUrl || !appVersion || !minCliVersion) {
    return null;
  }
  try {
    new URL(convexUrl);
    new URL(convexSiteUrl);
  } catch {
    return null;
  }
  return { service: "fcsia", convexUrl, convexSiteUrl, appVersion, minCliVersion };
}

function assertSupported(host: string, document: CliDiscoveryDocument) {
  const version = cliVersion();
  if (version.endsWith("-dev") || !isOlderVersion(version, document.minCliVersion)) return;
  throw new CliError(
    "platform",
    "cli_outdated",
    `${host} needs CLI ${document.minCliVersion} or later; this is ${version}. Upgrade the CLI.`,
    { data: { host, version, minCliVersion: document.minCliVersion } },
  );
}

// Finds the backend for a site from its discovery document. The document is
// reused for an hour so most commands make no extra request.
export async function discover(context: CommandContext, host: string, options: { fresh?: boolean } = {}) {
  const directory = configDirectory(context.runtime, context.globals.globalConfig);
  const cached = readConfig(directory).hosts?.[host]?.discovery;
  const now = Date.now();
  if (!options.fresh && cached && now - cached.fetchedAt < DISCOVERY_TTL_MS) {
    const document = asDiscovery(cached.document);
    if (document) {
      assertSupported(host, document);
      return document;
    }
  }

  const response = await requestJson(context.runtime, `${host}${CLI_DISCOVERY_PATH}`);
  const document = response.status === 200 ? asDiscovery(response.body) : null;
  if (!document) {
    throw new CliError("platform", "unsupported_host", `${host} isn't an IA App site.`, {
      data: { host, status: response.status },
    });
  }
  assertSupported(host, document);
  try {
    updateConfig(directory, (config) => ({
      ...config,
      hosts: {
        ...config.hosts,
        [host]: { ...config.hosts?.[host], discovery: { document, fetchedAt: now } },
      },
    }));
  } catch {
    // A read-only settings directory only costs a request next time.
  }
  return document;
}
