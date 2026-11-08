// An in-memory stand-in for a site, its Better Auth routes, and the Convex
// functions the CLI calls, for tests that exercise real HTTP handling.

export const HOST = "https://app.fcsia.com";
export const CONVEX_URL = "https://cloud.example.test";
export const CONVEX_SITE_URL = "https://site.example.test";

export interface FakeSession {
  id: string;
  token: string;
  current?: boolean;
}

export interface FakeBackendOptions {
  minCliVersion?: string;
  // Responses to successive /device/token polls, after which it approves.
  pendingPolls?: Array<"authorization_pending" | "slow_down" | "access_denied" | "expired_token">;
  validTokens?: string[];
  profile?: Record<string, unknown> | null;
  discoveryStatus?: number;
}

export function fakeBackend(options: FakeBackendOptions = {}) {
  const validTokens = new Set(options.validTokens ?? []);
  const pending = [...(options.pendingPolls ?? [])];
  const sessions: Array<{ id: string; token: string }> = [...validTokens].map((token, index) => ({
    id: `session${index + 1}`,
    token,
  }));
  const calls: string[] = [];
  let issued = 0;
  const profile =
    options.profile === undefined
      ? { _id: "user1", uniqueId: "STU050", firstName: "David", lastName: "Jones", roles: ["STUDENT"] }
      : options.profile;

  const json = (body: unknown, status = 200) => Response.json(body, { status });
  const bearer = (request: Request) => request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const jwtToken = (jwt: string) => jwt.replace(/^jwt:/, "");

  async function convex(request: Request, kind: "query" | "mutation") {
    const { path, args } = (await request.json()) as { path: string; args: unknown[] };
    calls.push(`${kind} ${path}`);
    const token = jwtToken(bearer(request));
    if (!validTokens.has(token)) {
      return json({ status: "error", errorMessage: "Unauthenticated", errorData: "Unauthenticated", logLines: [] }, 560);
    }
    const value = (() => {
      if (path === "users/me:me") return profile;
      if (path === "users/cliSessions:list") {
        return sessions.map((session) => ({
          id: session.id,
          client: "Command-line client 0.1.0 on macOS",
          version: "0.1.0",
          platform: "macOS arm64",
          createdAt: Date.UTC(2026, 10, 8, 18),
          lastUsedAt: Date.UTC(2026, 10, 8, 18, 5),
          expiresAt: Date.UTC(2026, 10, 15, 18),
          current: session.token === token,
        }));
      }
      if (path === "users/cliSessions:revoke") {
        const { sessionId } = (args[0] ?? {}) as { sessionId: string };
        const index = sessions.findIndex((session) => session.id === sessionId);
        if (index === -1) return { outcome: "unchanged" };
        validTokens.delete(sessions[index]!.token);
        sessions.splice(index, 1);
        return { outcome: "revoked" };
      }
      throw new Error(`unexpected function ${path}`);
    })();
    return json({ status: "success", value, logLines: [] });
  }

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const where = `${url.origin}${url.pathname}`;
    if (where === `${HOST}/.well-known/fcsia-cli.json`) {
      calls.push("discovery");
      if (options.discoveryStatus) return new Response("nope", { status: options.discoveryStatus });
      return json({
        service: "fcsia",
        convexUrl: CONVEX_URL,
        convexSiteUrl: CONVEX_SITE_URL,
        appVersion: "1.0.0",
        minCliVersion: options.minCliVersion ?? "0.1.0",
      });
    }
    if (where === `${CONVEX_SITE_URL}/api/auth/device/code`) {
      calls.push("device code");
      return json({
        device_code: "device-code",
        user_code: "ABCDEFGH",
        verification_uri: `${HOST}/device`,
        verification_uri_complete: `${HOST}/device?user_code=ABCDEFGH`,
        expires_in: 600,
        interval: 5,
      });
    }
    if (where === `${CONVEX_SITE_URL}/api/auth/device/token`) {
      calls.push("device token");
      const next = pending.shift();
      if (next) return json({ error: next, error_description: next }, 400);
      issued += 1;
      const token = `issued${issued}`;
      validTokens.add(token);
      sessions.push({ id: `issued-session${issued}`, token });
      return json({ access_token: token, token_type: "Bearer", expires_in: 604800, scope: "" });
    }
    if (where === `${CONVEX_SITE_URL}/api/auth/convex/token`) {
      calls.push("jwt");
      const token = bearer(request);
      return validTokens.has(token) ? json({ token: `jwt:${token}` }) : json({ code: "UNAUTHORIZED" }, 401);
    }
    if (where === `${CONVEX_SITE_URL}/api/auth/sign-out`) {
      calls.push("sign out");
      const token = bearer(request);
      if (!validTokens.has(token)) return json({ code: "UNAUTHORIZED" }, 401);
      validTokens.delete(token);
      return json({ success: true });
    }
    if (where === `${CONVEX_URL}/api/query`) return convex(request, "query");
    if (where === `${CONVEX_URL}/api/mutation`) return convex(request, "mutation");
    throw new TypeError(`fetch failed: ${where}`);
  }

  return { handle, calls, validTokens, sessions };
}
