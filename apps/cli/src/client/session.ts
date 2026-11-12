import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import type { CliDiscoveryDocument } from "../../../shared/cli";
import { CliError } from "../core/errors";
import type { CommandContext } from "../registry/types";
import { exchangeForJwt } from "./auth";
import { loadCredential, type Credential } from "./credentials";
import { discover, hostArgv, resolveHost, type HostSource } from "./host";

export interface Connection {
  host: string;
  hostSource: HostSource;
  discovery: CliDiscoveryDocument;
  credential: Credential;
  client: ConvexHttpClient;
}

function signInStep(host: string, source: HostSource) {
  return { benefit: "Sign in", argv: ["login", ...hostArgv(host, source)] };
}

export function notSignedIn(host: string, source: HostSource) {
  return new CliError("authentication", "not_signed_in", `You're not signed in to ${host}.`, {
    userActionRequired: true,
    next: [signInStep(host, source)],
  });
}

function rejected(host: string, source: HostSource, credential: Credential) {
  if (credential.source === "option" || credential.source === "environment") {
    const where = credential.source === "option" ? "--token" : "FCSIA_TOKEN";
    return new CliError("authentication", "invalid_token", `${host} didn't accept the token from ${where}.`, {
      userActionRequired: true,
    });
  }
  return new CliError("authentication", "session_expired", `Your sign-in to ${host} expired or was signed out.`, {
    userActionRequired: true,
    next: [signInStep(host, source)],
  });
}

// Resolves the site, its backend, and a signed-in Convex client.
export async function connect(context: CommandContext): Promise<Connection> {
  const { host, source } = resolveHost(context);
  const credential = await loadCredential(context, host);
  if (!credential) throw notSignedIn(host, source);
  const discovery = await discover(context, host);
  const jwt = await exchangeForJwt(context.runtime, discovery, credential.token);
  if (!jwt) throw rejected(host, source, credential);
  const client = new ConvexHttpClient(discovery.convexUrl, {
    fetch: context.runtime.fetch,
    logger: false,
  });
  client.setAuth(jwt);
  return { host, hostSource: source, discovery, credential, client };
}

function convexMessage(error: unknown) {
  if (error instanceof ConvexError) {
    return typeof error.data === "string" ? error.data : JSON.stringify(error.data);
  }
  return error instanceof Error ? error.message : String(error);
}

export function translateError(connection: Connection, error: unknown, kind: "query" | "mutation"): CliError {
  if (error instanceof CliError) return error;
  const message = convexMessage(error);
  if (/unauthenticated/i.test(message)) return rejected(connection.host, connection.hostSource, connection.credential);
  if (/password reset required/i.test(message)) {
    return new CliError("authentication", "password_reset_required", "Change your password on the web, then try again.", {
      userActionRequired: true,
      data: { url: `${connection.host}/change-password` },
    });
  }
  if (error instanceof ConvexError) {
    return new CliError("platform", "request_failed", message);
  }
  const network = error instanceof TypeError || /fetch failed|network/i.test(message);
  if (network && kind === "mutation") {
    // The request may have reached the server; never claim it didn't happen.
    return new CliError("unknown_outcome", "unknown_outcome", `Lost the connection to ${connection.host}; the change may or may not have been made.`, {
      retryable: false,
    });
  }
  if (network) {
    return new CliError("network", "network_error", `Can't reach ${connection.host}.`, { retryable: true });
  }
  return new CliError("platform", "request_failed", message);
}

const QUERY_ATTEMPTS = 2;

// Queries are safe to repeat, so one network failure is retried.
export async function query<Query extends FunctionReference<"query">>(
  connection: Connection,
  reference: Query,
  args: FunctionArgs<Query>,
): Promise<FunctionReturnType<Query>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < QUERY_ATTEMPTS; attempt += 1) {
    try {
      return await connection.client.query(reference, args);
    } catch (error) {
      lastError = error;
      if (!(error instanceof TypeError)) break;
    }
  }
  throw translateError(connection, lastError, "query");
}

// Mutations are never retried.
export async function mutation<Mutation extends FunctionReference<"mutation">>(
  connection: Connection,
  reference: Mutation,
  args: FunctionArgs<Mutation>,
): Promise<FunctionReturnType<Mutation>> {
  try {
    return await connection.client.mutation(reference, args);
  } catch (error) {
    throw translateError(connection, error, "mutation");
  }
}
