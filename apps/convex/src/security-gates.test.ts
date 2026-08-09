import { describe, expect, test } from "vitest";
import { assertPasswordResetComplete } from "../lib/currentUser";
import { isLocalDemoSeedEnabled } from "./seed";

describe("forced password reset gate", () => {
  test("blocks users who still have a temporary password", () => {
    expect(() =>
      assertPasswordResetComplete({ mustResetPassword: true }),
    ).toThrow(/password reset required/i);
  });

  test("allows users after the password has been changed", () => {
    expect(() =>
      assertPasswordResetComplete({ mustResetPassword: false }),
    ).not.toThrow();
  });
});

describe("demo seed guard", () => {
  test("is disabled unless the isolated-local flag is explicit", () => {
    expect(isLocalDemoSeedEnabled(undefined)).toBe(false);
    expect(isLocalDemoSeedEnabled("false")).toBe(false);
    expect(isLocalDemoSeedEnabled("true")).toBe(true);
  });
});
