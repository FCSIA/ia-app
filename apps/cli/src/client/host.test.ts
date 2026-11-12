import { describe, expect, test } from "bun:test";
import { CliError } from "../core/errors";
import { isOlderVersion, normalizeHost } from "./host";

describe("normalizeHost", () => {
  test("accepts a bare domain or URL and keeps only the origin", () => {
    expect(normalizeHost("app.fcsia.com")).toBe("https://app.fcsia.com");
    expect(normalizeHost("https://app.fcsia.com/device?x=1")).toBe("https://app.fcsia.com");
    expect(normalizeHost("http://localhost:3000")).toBe("http://localhost:3000");
  });

  test("plain http is only allowed for this computer", () => {
    expect(() => normalizeHost("http://app.fcsia.com")).toThrow(CliError);
    expect(() => normalizeHost("ftp://app.fcsia.com")).toThrow(CliError);
    expect(() => normalizeHost("not a host")).toThrow(CliError);
  });
});

describe("isOlderVersion", () => {
  test("compares major, minor, and patch numerically", () => {
    expect(isOlderVersion("0.9.0", "0.10.0")).toBe(true);
    expect(isOlderVersion("1.0.0", "0.10.0")).toBe(false);
    expect(isOlderVersion("0.10.0", "0.10.0")).toBe(false);
    expect(isOlderVersion("0.10.0-beta.1", "0.10.1")).toBe(true);
    expect(isOlderVersion("garbage", "0.1.0")).toBe(false);
  });
});
