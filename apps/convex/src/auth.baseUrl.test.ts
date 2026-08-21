import { describe, expect, test } from "vitest";
import {
  authBaseURL,
  canAllowAnyLocalWebHost,
  configuredAuthHostnames,
  createAuthOptions,
} from "./auth";

// Regression guard for the 2026-08-12 production login outage.
//
// Auth requests reach Convex through the web app's /api/auth proxy, so the host
// the browser actually used survives only in the forwarded headers that the
// Convex Better Auth component restores onto `x-forwarded-host`.
//
// Better Auth's `getBaseURL` short-circuits on a static string:
//     if (url) return withPath(url, path);
// which skips forwarded-host resolution entirely and pins every deployment to
// one hardcoded origin. Setting `baseURL` to a plain string took production
// login down: sign-in returned 200 but the session was resolved against the
// wrong public origin, so the proxy's `isAuthenticated()` never saw a session
// and every user bounced straight back to /login.
//
// `baseURL` must therefore stay a dynamic config object.
describe("Better Auth base URL resolution", () => {
  test("is a dynamic config, not a static string", () => {
    expect(typeof authBaseURL).toBe("object");
    expect(authBaseURL).not.toBeNull();
    expect(Array.isArray((authBaseURL as { allowedHosts?: unknown }).allowedHosts)).toBe(true);
  });

  test("derives the protocol from the incoming request", () => {
    expect((authBaseURL as { protocol?: unknown }).protocol).toBe("auto");
  });

  test("keeps a fallback origin for requests without a forwarded host", () => {
    expect(typeof (authBaseURL as { fallback?: unknown }).fallback).toBe("string");
    expect((authBaseURL as { fallback: string }).fallback.length).toBeGreaterThan(0);
  });

  test.each(["ia-app-alpha.vercel.app", "localhost", "127.0.0.1"])(
    "allows %s as a public auth host",
    (host) => {
      expect(configuredAuthHostnames).toContain(host);
    },
  );

  test("allows arbitrary forwarded hosts only for explicitly enabled loopback development", () => {
    expect(canAllowAnyLocalWebHost("true", "http://localhost:3000")).toBe(true);
    expect(canAllowAnyLocalWebHost("true", "http://127.0.0.1:3000")).toBe(true);
    expect(canAllowAnyLocalWebHost("false", "http://localhost:3000")).toBe(false);
    expect(canAllowAnyLocalWebHost("true", "https://app.example.com")).toBe(false);
  });

  // The guard above only protects the exported constant. This asserts the
  // constant is actually the one handed to Better Auth, so replacing
  // `baseURL: authBaseURL` with a string still fails the suite.
  test("wires the dynamic config into the Better Auth options", () => {
    const options = createAuthOptions({} as Parameters<typeof createAuthOptions>[0]);
    expect(options.baseURL).toBe(authBaseURL);
    expect(typeof options.baseURL).not.toBe("string");
  });
});
