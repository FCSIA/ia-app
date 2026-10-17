import { describe, expect, test } from "bun:test";
import { parseReleaseArgs } from "./release-args.mjs";

describe("release arguments", () => {
  test.each([
    [["--minor"], ["--minor"]],
    [["--patch"], ["--patch"]],
    [["--set=1.2.3"], ["--set=1.2.3"]],
    [["--minor", "--dry-run"], ["--minor"]],
    [[], []],
  ])("accepts %j", (args, releaseFlags) => {
    expect(parseReleaseArgs(args)).toEqual({ dryRun: args.includes("--dry-run"), releaseFlags });
  });

  test.each([
    ["--minor", "--patch"],
    ["--minor", "--set=1.2.3"],
    ["--patch", "--set=1.2.3"],
    ["--patch", "--patch"],
  ])("rejects conflicting version flags %s and %s", (...args) => {
    expect(() => parseReleaseArgs(args)).toThrow("choose at most one version option");
  });
});
