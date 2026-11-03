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
// GitHub, hooks, signing, and production. GitHub CLI requests are stubbed.
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
  for (const name of ["GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL"]) delete env[name];
  const capture = (command, args) => execFileSync(command, args, { cwd: checkout, env, encoding: "utf8", stdio: "pipe" }).trim();
  const git = (...args) => capture("git", args);
  const node = (...args) => capture("node", args);
  mkdirSync(path.join(checkout, "scripts"), { recursive: true });
  mkdirSync(path.join(checkout, "packages/devlog/data"), { recursive: true });
  mkdirSync(path.join(checkout, "packages/devlog/src"), { recursive: true });
  mkdirSync(bin);
  mkdirSync(path.join(directory, "hooks"));
  for (const file of ["release.mjs", "release-args.mjs", "devlog.mjs", "validate-release.mjs"]) {
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
import { readFileSync, writeFileSync } from "node:fs";
writeFileSync(process.env.RELEASE_TEST_GH_ARGS, JSON.stringify(process.argv.slice(2)));
if (process.argv[2] === "api") process.stdout.write(readFileSync(process.env.RELEASE_TEST_PR_JSON, "utf8"));
else process.stdout.write("https://github.com/example/fixture/pull/1\\n");
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
    directory,
    ghArgsPath,
    run: (command, ...args) => spawnSync("bun", ["run", command, ...args], { cwd: checkout, env, encoding: "utf8" }),
    shell: (script, variables) => spawnSync("bash", ["-e", "-c", script], { cwd: checkout, env: { ...env, ...variables }, encoding: "utf8" }),
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

describe("release publishing workflow", () => {
  const workflow = Bun.YAML.parse(readFileSync(path.join(root, ".github/workflows/release-on-push.yml"), "utf8"));
  const publish = workflow.jobs["tag-release"].steps.find((step) => step.id === "release").run;
  function prepared() {
    const fixture = releaseFixture();
    const result = fixture.run("release");
    expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: expect.any(String) });
    return fixture;
  }
  function variables(fixture) {
    return { RELEASE_SHA: fixture.git("rev-parse", "HEAD"), GITHUB_OUTPUT: path.join(fixture.directory, "published-output") };
  }

  test("publishes the exact main release as the Actions bot and safely retries", () => {
    const fixture = prepared();
    const { git, shell } = fixture;
    const env = variables(fixture);
    git("config", "--unset", "user.name");
    git("config", "--unset", "user.email");
    const result = shell(publish, env);
    expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: expect.any(String) });
    expect(git("cat-file", "-t", "v0.1.1")).toBe("tag");
    expect(git("rev-parse", "v0.1.1^{commit}")).toBe(env.RELEASE_SHA);
    expect(git("for-each-ref", "--format=%(taggername) <%(taggeremail:trim)>", "refs/tags/v0.1.1")).toBe(
      "github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
    );
    expect(git("ls-remote", "origin", "refs/tags/v0.1.1^{}").split(/\s+/)[0]).toBe(env.RELEASE_SHA);
    expect(readFileSync(env.GITHUB_OUTPUT, "utf8")).toBe("release_tag=v0.1.1\n");
    const tag = git("rev-parse", "v0.1.1");
    expect(shell(publish, env).status).toBe(0);
    expect(git("rev-parse", "v0.1.1")).toBe(tag);
  }, 15_000);

  test("refuses to move a tag pointing at another commit", () => {
    const fixture = prepared();
    fixture.git("tag", "v0.1.1", fixture.main);
    const result = fixture.shell(publish, variables(fixture));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("refusing to move it");
    expect(fixture.git("rev-parse", "v0.1.1^{commit}")).toBe(fixture.main);
  });

  test.each(["wrong base", "wrong subject", "mixed code", "changed history", "unchanged version", "generated drift"])("rejects %s before publishing", (kind) => {
    const fixture = prepared();
    const { git, directory } = fixture;
    const checkout = path.join(directory, "checkout");
    let subject = "release: v0.1.1";
    let base = fixture.main;
    if (kind === "wrong base") base = "a".repeat(40);
    if (kind === "wrong subject") subject = "docs: update releases";
    if (kind === "mixed code") writeFileSync(path.join(checkout, "feature.txt"), "Unreviewed extra change\n");
    if (kind === "generated drift") writeFileSync(path.join(checkout, "CHANGELOG.md"), "Out of sync\n");
    if (kind === "changed history" || kind === "unchanged version") {
      const dataPath = path.join(checkout, "packages/devlog/data/releases.json");
      const log = JSON.parse(readFileSync(dataPath, "utf8"));
      if (kind === "changed history") log.releases[1].changes[0].summary = "Rewritten history";
      else { log.releases[0].version = "0.1.0"; subject = "release: v0.1.0"; }
      writeFileSync(dataPath, JSON.stringify(log));
    }
    git("add", ".");
    git("commit", "--amend", "-m", subject, "-m", `Release-Base: ${base}`);
    // Force is confined to this test's disposable local bare repository.
    git("push", "--force", "origin", "main");
    const env = variables(fixture);
    expect(fixture.shell(publish, env).status).not.toBe(0);
    expect(git("tag", "--list", "v0.1.1")).toBe("");
    expect(existsSync(env.GITHUB_OUTPUT)).toBe(false);
  });

  test("rejects a non-main commit, a mismatched checkout, and invalid SHA input", () => {
    const fixture = prepared();
    const env = variables(fixture);
    expect(fixture.shell(publish, { ...env, RELEASE_SHA: fixture.main }).status).not.toBe(0);
    expect(fixture.shell(publish, { ...env, RELEASE_SHA: "main" }).status).not.toBe(0);
    fixture.git("update-ref", "refs/remotes/origin/main", fixture.main);
    expect(fixture.shell(publish, env).status).not.toBe(0);
    expect(fixture.git("tag", "--list", "v0.1.1")).toBe("");
  });
});

describe("production release validation", () => {
  const workflow = Bun.YAML.parse(readFileSync(path.join(root, ".github/workflows/prod.yml"), "utf8"));
  const resolve = workflow.jobs.resolve.steps.find((step) => step.id === "release").run;

  test("resolves an existing main tag to the full commit used for CI and deployment", () => {
    const fixture = releaseFixture();
    expect(fixture.run("release").status).toBe(0);
    const sha = fixture.git("rev-parse", "HEAD");
    fixture.git("tag", "v0.1.1");
    const output = path.join(fixture.directory, "resolved-output");
    expect(fixture.shell(resolve, { RELEASE_TAG: "v0.1.1", GITHUB_OUTPUT: output }).status).toBe(0);
    expect(readFileSync(output, "utf8")).toContain(`full_sha=${sha}\n`);
    fixture.git("checkout", fixture.main);
    expect(fixture.shell(resolve, { RELEASE_TAG: "v0.1.1", GITHUB_OUTPUT: output }).status).not.toBe(0);
    expect(fixture.shell(resolve, { RELEASE_TAG: "main", GITHUB_OUTPUT: output }).status).not.toBe(0);
  });

  test("deployment waits for full CI on the same immutable SHA", () => {
    expect(workflow.jobs.validate.needs).toBe("resolve");
    expect(workflow.jobs.validate.uses).toBe("./.github/workflows/contributor-validation.yml");
    expect(workflow.jobs.validate.with.checkout_ref).toBe("${{ needs.resolve.outputs.sha }}");
    expect(workflow.jobs.deploy.needs).toEqual(["resolve", "validate"]);
    expect(workflow.jobs.deploy.steps[0].with.ref).toBe("${{ needs.resolve.outputs.sha }}");
    expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
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

  test.each(["release", "release:ship"])("%s commits and pushes main without a PR or local tag", (command) => {
    const { run, git, main, ghArgsPath } = releaseFixture();
    const result = run(command);
    expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: expect.any(String) });
    expect(result.stdout).toContain("Published release commit for v0.1.1 to main.");
    expect(git("branch", "--show-current")).toBe("main");
    expect(git("rev-parse", "HEAD^1")).toBe(main);
    expect(git("log", "-1", "--format=%s")).toBe("release: v0.1.1");
    expect(git("log", "-1", "--format=%(trailers:key=Release-Base,valueonly)")).toBe(main);
    expect(git("diff", "--name-only", "HEAD^1", "HEAD").split("\n")).toEqual([
      "CHANGELOG.md", "packages/devlog/data/releases.json", "packages/devlog/src/releases.generated.ts",
    ]);
    expect(git("ls-remote", "origin", "refs/heads/main").split(/\s+/)[0]).toBe(git("rev-parse", "HEAD"));
    expect(git("branch", "--list", "release/*")).toBe("");
    expect(git("tag", "--list")).toBe("v0.1.0");
    expect(git("ls-remote", "--tags", "origin")).toBe("");
    expect(git("status", "--porcelain")).toBe("");
    expect(existsSync(ghArgsPath)).toBe(false);
  });

  test("a rejected push preserves the local release without changing remote main", () => {
    const fixture = releaseFixture();
    writeFileSync(path.join(fixture.directory, "origin.git/hooks/pre-receive"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    const result = fixture.run("release");
    expect(result.status).not.toBe(0);
    expect(fixture.git("log", "-1", "--format=%s")).toBe("release: v0.1.1");
    expect(fixture.git("rev-parse", "HEAD^1")).toBe(fixture.main);
    expect(fixture.git("ls-remote", "origin", "refs/heads/main").split(/\s+/)[0]).toBe(fixture.main);
    expect(fixture.git("tag", "--list", "v0.1.1")).toBe("");
  });

  test("refuses dirty and unsynchronized main before release generation", () => {
    const fixture = releaseFixture();
    writeFileSync(path.join(fixture.directory, "checkout/dirty.txt"), "Keep this work\n");
    expect(fixture.run("release").status).not.toBe(0);
    fixture.git("add", ".");
    fixture.git("commit", "-m", "local: unpushed work");
    const result = fixture.run("release");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("not synchronized");
    expect(fixture.git("ls-remote", "origin", "refs/heads/main").split(/\s+/)[0]).toBe(fixture.main);
  });
});
