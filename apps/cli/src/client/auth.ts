import type { CliDiscoveryDocument } from "../../../shared/cli";
import { CliError } from "../core/errors";
import type { Runtime } from "../core/runtime";
import { field, requestJson, retryAfterSeconds, textField, type JsonResponse } from "./http";

// RFC 8628 device sign-in against Better Auth on the Convex site, then the
// exchange of the session token for a short-lived Convex JWT.

export const CLIENT_ID = "fcsia-cli";
const GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";
const SLOW_DOWN_STEP_MS = 5_000;
const MAX_CONSECUTIVE_NETWORK_FAILURES = 5;

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
}

export interface IssuedSession {
  token: string;
  expiresIn: number;
}

function authUrl(discovery: CliDiscoveryDocument, path: string) {
  return `${discovery.convexSiteUrl.replace(/\/$/, "")}/api/auth${path}`;
}

function rateLimited(response: JsonResponse) {
  const retryAfter = retryAfterSeconds(response);
  return new CliError(
    "rate_limit",
    "rate_limited",
    retryAfter
      ? `Too many sign-in attempts. Try again in ${retryAfter} seconds.`
      : "Too many sign-in attempts. Try again later.",
    { retryable: true, retryAfter },
  );
}

function unexpected(response: JsonResponse, what: string) {
  return new CliError("platform", "unexpected_response", `The site answered ${what} with HTTP ${response.status}.`, {
    retryable: response.status >= 500,
    data: { status: response.status, error: textField(response.body, "error") ?? null },
  });
}

// The user code as people read it aloud: ABCD-EFGH.
export function formatUserCode(code: string) {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

// The approval page lives on the site the person chose, which can differ from
// the address the backend was configured with (a local or preview server).
function onSite(url: string, host: string) {
  try {
    const parsed = new URL(url);
    return `${host}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

export async function requestDeviceCode(
  runtime: Runtime,
  discovery: CliDiscoveryDocument,
  host: string,
): Promise<DeviceCode> {
  const response = await requestJson(runtime, authUrl(discovery, "/device/code"), {
    method: "POST",
    body: { client_id: CLIENT_ID },
  });
  if (response.status === 429) throw rateLimited(response);
  const body = response.body;
  const deviceCode = textField(body, "device_code");
  const userCode = textField(body, "user_code");
  const verificationUri = textField(body, "verification_uri");
  const verificationUriComplete = textField(body, "verification_uri_complete");
  const expiresIn = field(body, "expires_in");
  const interval = field(body, "interval");
  if (
    response.status !== 200 ||
    !deviceCode ||
    !userCode ||
    !verificationUri ||
    typeof expiresIn !== "number" ||
    typeof interval !== "number"
  ) {
    throw unexpected(response, "the sign-in request");
  }
  return {
    deviceCode,
    userCode,
    verificationUri: onSite(verificationUri, host),
    verificationUriComplete: onSite(verificationUriComplete ?? verificationUri, host),
    expiresIn,
    interval,
  };
}

// Polls until someone approves or denies the code, or it expires. Follows the
// server's interval and backs off on `slow_down`, as RFC 8628 requires.
export async function waitForApproval(
  runtime: Runtime,
  discovery: CliDiscoveryDocument,
  code: DeviceCode,
): Promise<IssuedSession> {
  const deadline = Date.now() + code.expiresIn * 1000;
  let interval = code.interval * 1000;
  let networkFailures = 0;

  while (Date.now() < deadline) {
    await runtime.sleep(interval, runtime.signal);
    if (runtime.signal.aborted) throw new CliError("canceled", "canceled", "Canceled.");

    let response: JsonResponse;
    try {
      response = await requestJson(runtime, authUrl(discovery, "/device/token"), {
        method: "POST",
        body: { grant_type: GRANT_TYPE, device_code: code.deviceCode, client_id: CLIENT_ID },
      });
      networkFailures = 0;
    } catch (error) {
      // A dropped connection while someone is still approving isn't fatal.
      if (error instanceof CliError && error.reason === "network_error") {
        networkFailures += 1;
        if (networkFailures < MAX_CONSECUTIVE_NETWORK_FAILURES) continue;
      }
      throw error;
    }

    const token = textField(response.body, "access_token");
    const expiresIn = field(response.body, "expires_in");
    if (response.status === 200 && token) {
      return { token, expiresIn: typeof expiresIn === "number" ? expiresIn : 0 };
    }
    const error = textField(response.body, "error");
    if (error === "authorization_pending") continue;
    if (error === "slow_down") {
      interval += SLOW_DOWN_STEP_MS;
      continue;
    }
    if (error === "access_denied") {
      throw new CliError("authentication", "sign_in_denied", "The sign-in was denied in the browser.");
    }
    if (error === "expired_token") break;
    if (response.status === 429) throw rateLimited(response);
    throw unexpected(response, "the sign-in check");
  }

  throw new CliError("authentication", "sign_in_expired", "The sign-in code expired before it was approved.", {
    retryable: true,
  });
}

// Exchanges a session token for a Convex JWT. Returns null when the site no
// longer accepts the token: it expired, was revoked, or never existed.
export async function exchangeForJwt(runtime: Runtime, discovery: CliDiscoveryDocument, token: string) {
  const response = await requestJson(runtime, authUrl(discovery, "/convex/token"), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (response.status === 401 || response.status === 403) return null;
  const jwt = textField(response.body, "token");
  if (response.status !== 200 || !jwt) throw unexpected(response, "the session check");
  return jwt;
}

// Ends the session on the server. Returns false when the server no longer had
// it, which is still signed out.
export async function signOutSession(runtime: Runtime, discovery: CliDiscoveryDocument, token: string) {
  // No cookies are sent, so Better Auth's browser origin check doesn't apply.
  const response = await requestJson(runtime, authUrl(discovery, "/sign-out"), {
    method: "POST",
    body: {},
    headers: { authorization: `Bearer ${token}` },
  });
  if (response.status === 200) return field(response.body, "success") === true;
  if (response.status === 401) return false;
  throw unexpected(response, "the sign-out");
}
