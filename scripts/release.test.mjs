import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseReleaseArgs } from "./release-args.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

// Real release scripts and Git operations, isolated from the working checkout,
// GitHub, hooks, signing, and production. Only `gh pr create` is stubbed.
function releaseFixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "ia-release-test-"));
  temporaryDirectories.push(directory);
  const checkout = path.join(directory, "checkout");
  const origin = path.join(directory, "origin.git");
  const bin = path.join(directory, "bin");
  const ghArgsPath = path.join(directory, "gh-args.json");
  const env = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    RELEASE_TEST_GH_ARGS: ghArgsPath,
  };
  const capture = (command, args) => execFileSync(command, args, { cwd: checkout, env, encoding: "utf8", stdio: "pipe" }).trim();
  const git = (...args) => capture("git", args);
  const node = (...args) => capture("node", args);
  mkdirSync(path.join(checkout, "scripts"), { recursive: true });
  mkdirSync(path.join(checkout, "packages/devlog/data"), { recursive: true });
  mkdirSync(path.join(checkout, "packages/devlog/src"), { recursive: true });
  mkdirSync(bin);
  mkdirSync(path.join(directory, "hooks"));
  for (const file of ["release.mjs", "release-args.mjs", "devlog.mjs"]) {
    copyFileSync(path.join(root, "scripts", file), path.join(checkout, "scripts", file));
  }
  const { scripts } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  writeFileSync(path.join(checkout, "package.json"), JSON.stringify({
    private: true,
    scripts: { release: scripts.release, "release:ship": scripts["release:ship"] },
  }));
  writeFileSync(path.join(checkout, "packages/devlog/data/releases.json"), JSON.stringify({
    channel: "alpha",
    releases: [{ version: "0.1.0", date: "2026-01-01", changes: [{ category: "Added", summary: "Initial release." }] }],
  }));
  writeFileSync(path.join(bin, "gh"), `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
writeFileSync(process.env.RELEASE_TEST_GH_ARGS, JSON.stringify(process.argv.slice(2)));
process.stdout.write("https://github.com/example/fixture/pull/1\\n");
`, { mode: 0o755 });

  git("init", "--initial-branch=main");
  git("config", "user.name", "Release test");
  git("config", "user.email", "release-test@example.invalid");
  git("config", "core.hooksPath", path.join(directory, "hooks"));
  node("scripts/devlog.mjs", "generate");
  git("add", ".");
  git("commit", "-m", "release: v0.1.0");
  git("tag", "v0.1.0");
  writeFileSync(path.join(checkout, "feature.txt"), "New announcement previews\n");
  git("add", ".");
  git("commit", "-m", "announcements: add previews", "-m", "Devlog: Show {clearer} previews.");
  git("init", "--bare", "--initial-branch=main", origin);
  git("remote", "add", "origin", origin);
  git("push", "--set-upstream", "origin", "main");
  const main = git("rev-parse", "main");

  return {
    git,
    node,
    main,
    ghArgsPath,
    run: (command, ...args) => spawnSync("bun", ["run", command, ...args], { cwd: checkout, env, encoding: "utf8" }),
  };
}

describe("release arguments", () => {
  test.each([
    [["--minor"], ["--minor"]],
    [["--patch"], ["--patch"]],
    [["--set=1.2.3"], ["--set=1.2.3"]],
    [["--minor", "--dry-run"], ["--minor"]],
    [["--", "--minor"], ["--minor"]],
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

describe("release CLI", () => {
  test("JSON previews exclude the human baseline and Markdown, even with braces in release text", () => {
    const { node, git, main } = releaseFixture();
    const flags = ["--title=Release {preview}", "--summary=Notes with } and { braces"];
    const human = node("scripts/devlog.mjs", "preview", ...flags);
    expect(human).toContain("Release baseline: v0.1.0");
    expect(human).toContain("## v0.1.1");

    const release = JSON.parse(node("scripts/devlog.mjs", "preview", ...flags, "--json"));
    expect(release.version).toBe("0.1.1");
    expect(release.title).toBe("Release {preview}");
    expect(release.summary).toBe("Notes with } and { braces");
    expect(release.changes[0].summary).toBe("Show {clearer} previews.");
    expect(JSON.parse(node("scripts/devlog.mjs", "cut", "--dry-run", ...flags, "--json"))).toEqual(release);
    expect(git("status", "--porcelain")).toBe("");
    expect(git("rev-parse", "HEAD")).toBe(main);
  });

  test.each(["release", "release:ship"])("%s dry run leaves files, branches, and tags unchanged", (command) => {
    const { run, git, ghArgsPath } = releaseFixture();
    git("push", "origin", "HEAD:refs/tags/remote-only");
    const refs = git("show-ref");
    const remoteRefs = git("ls-remote", "origin");
    const result = run(command, "--dry-run");
    expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: expect.any(String) });
    expect(result.stdout).toContain("Release baseline: v0.1.0");
    expect(result.stdout).toContain("release: dry run;");
    expect(git("show-ref")).toBe(refs);
    expect(git("ls-remote", "origin")).toBe(remoteRefs);
    expect(git("status", "--porcelain")).toBe("");
    expect(existsSync(ghArgsPath)).toBe(false);
  });

  test.each(["release", "release:ship"])("%s prepares a release PR without pushing main or creating a tag", (command) => {
    const { run, git, main, ghArgsPath } = releaseFixture();
    const result = run(command);
    expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: expect.any(String) });
    expect(result.stdout).toContain("Release PR: https://github.com/example/fixture/pull/1");
    expect(git("branch", "--show-current")).toBe("release/v0.1.1");
    expect(git("rev-parse", "HEAD^1")).toBe(main);
    expect(git("log", "-1", "--format=%(trailers:key=Release-Base,valueonly)")).toBe(main);
    expect(git("diff", "--name-only", "main...HEAD").split("\n")).toEqual([
      "CHANGELOG.md",
      "packages/devlog/data/releases.json",
      "packages/devlog/src/releases.generated.ts",
    ]);
    expect(git("rev-parse", "main")).toBe(main);
    expect(git("ls-remote", "origin", "refs/heads/main").split(/\s+/)[0]).toBe(main);
    expect(git("ls-remote", "origin", "refs/heads/release/v0.1.1").split(/\s+/)[0]).toBe(git("rev-parse", "HEAD"));
    expect(git("tag", "--list")).toBe("v0.1.0");
    expect(git("ls-remote", "--tags", "origin")).toBe("");
    expect(git("status", "--porcelain")).toBe("");
    expect(JSON.parse(readFileSync(ghArgsPath, "utf8")).slice(0, 6)).toEqual([
      "pr", "create", "--base", "main", "--head", "release/v0.1.1",
    ]);
  });
});
