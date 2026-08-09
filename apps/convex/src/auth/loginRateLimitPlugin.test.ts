import { describe, expect, test } from "vitest";
import {
  APIError,
} from "better-auth/api";
import {
  credentialIdentifier,
  credentialIdentifierForRequest,
  isCredentialPath,
  isFailedCredentialResponse,
  trustedClientIp,
} from "./loginRateLimitPlugin";
import { loginBackoffMs } from "../authLoginRateLimit";

describe("credential rate-limit routing", () => {
  test("covers every password credential path and future sign-in providers", () => {
    for (const path of ["/sign-in/username", "/sign-in/email", "/sign-in/new-provider", "/change-password", "/forget-password"]) expect(isCredentialPath(path)).toBe(true);
    expect(isCredentialPath("/sign-up/email")).toBe(false);
  });

  test("extracts both username and email identifiers", () => {
    expect(credentialIdentifier({ username: "STU001" })).toBe("STU001");
    expect(credentialIdentifier({ email: "stu001@fcstu.org" })).toBe("stu001@fcstu.org");
  });

  test("keys password changes by the authenticated account without a body identifier", () => {
    expect(
      credentialIdentifierForRequest(
        "/change-password",
        { currentPassword: "old", newPassword: "new" },
        "auth-user-1",
      ),
    ).toBe("auth-user-1");
    expect(
      credentialIdentifierForRequest("/change-password", {}, undefined),
    ).toBe("unauthenticated-change-password");
  });

  test("counts both unauthorized login and invalid current-password failures", () => {
    expect(
      isFailedCredentialResponse(
        APIError.from("UNAUTHORIZED", {
          code: "INVALID_CREDENTIALS",
          message: "bad login",
        }),
      ),
    ).toBe(true);
    expect(
      isFailedCredentialResponse(
        APIError.from("BAD_REQUEST", {
          code: "INVALID_PASSWORD",
          message: "bad current password",
        }),
      ),
    ).toBe(true);
  });

  test("uses a platform IP or the right-most forwarded hop", () => {
    expect(trustedClientIp(new Request("https://example.test", { headers: { "x-forwarded-for": "spoofed, 10.0.0.5" } }))).toBe("10.0.0.5");
    expect(trustedClientIp(new Request("https://example.test", { headers: { "cf-connecting-ip": "203.0.113.4", "x-forwarded-for": "spoofed" } }))).toBe("203.0.113.4");
  });

  test("uses capped exponential account backoff", () => {
    expect(loginBackoffMs(4)).toBe(0);
    expect(loginBackoffMs(5)).toBe(30_000);
    expect(loginBackoffMs(6)).toBe(60_000);
    expect(loginBackoffMs(99)).toBe(30 * 60_000);
  });
});
