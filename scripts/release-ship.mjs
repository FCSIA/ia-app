#!/usr/bin/env node
/**
 * One-command release ship.
 *
 *   pnpm release:ship -- --minor --title="Calendar-first schedules"
 *   pnpm release:ship -- --title="Fix late-night sign-in" --yes
 *
 * From an up-to-date `main` checkout this runs the standard release flow in
 * one step: `devlog:cut`, the `release: vX.Y.Z` commit, the annotated
 * `vX.Y.Z` tag, and the push that starts the Production Deploy workflow.
 *
 * The release commit itself is kept on purpose: the deployed bundle reads its
 * version and devlog entries from the generated files, and `prod.yml`
 * requires the tag to match the latest approved `releases.json` version. This
 * script removes the manual toil, not the commit.
 *
 * Options (besides the `devlog:cut` flags below):
 *   --remote=<name>   Git remote to push to (default: origin)
 *   --no-fetch        Skip fetching the remote before the freshness check
 *   --no-push         Cut, commit, and tag locally without pushing
 *   --allow-branch    Allow running on a branch other than `main`
 *   --sign            Create a GPG-signed tag (`-s`) instead of annotated (`-a`)
 *   --yes, -y         Skip the confirmation prompt before pushing
 *   --dry-run         Show what the next release would contain; write nothing
 *   --help            Show this help
 *
 * `devlog:cut` flags passed through as-is:
 *   --major --minor --patch --set=X.Y.Z --title="..." --summary="..."
 *   --since=<ref> --date=YYYY-MM-DD --allow-empty
 */

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "packages/devlog/data/releases.json");
const devlogScript = path.join(root, "scripts", "devlog.mjs");

// Flags forwarded to `node scripts/devlog.mjs cut`.
const CUT_FLAGS_WITH_VALUE = new Set(["set", "title", "summary", "since", "date"]);
const CUT_FLAGS_BOOLEAN = new Set(["major", "minor", "patch", "allow-empty"]);

const RELEASE_PATHS = ["CHANGELOG.md", "packages/devlog"];

function fail(message) {
  process.stderr.write(`release:ship: ${message}\n`);
  process.exit(1);
}

function usage() {
  process.stdout.write(
    [
      "Usage: pnpm release:ship [--yes] [--no-push] [-- <devlog:cut flags>]",
      "",
      "Cut the next release, commit it, tag it, and push (default remote: origin).",
      "Pushing the tag starts the Production Deploy workflow.",
      "",
      "Examples:",
      '  pnpm release:ship -- --title="Fix late-night sign-in"',
      '  pnpm release:ship --yes -- --minor --title="Calendar-first schedules"',
      "  pnpm release:ship --no-push -- --allow-empty   # commit + tag locally only",
      "  pnpm release:ship --dry-run                    # preview; write nothing",
      "",
      "Ship options:",
      "  --remote=<name>   Git remote to push to (default: origin)",
      "  --no-fetch        Skip fetching the remote before the freshness check",
      "  --no-push         Cut, commit, and tag locally without pushing",
      "  --allow-branch    Allow running on a branch other than `main`",
      "  --sign            Create a GPG-signed tag instead of an annotated tag",
      "  --yes, -y         Skip the confirmation prompt before pushing",
      "  --dry-run         Show what the next release would contain; write nothing",
      "  --help            Show this help",
      "",
      "Passed through to `devlog:cut`:",
      "  --major --minor --patch --set=X.Y.Z --title=\"...\" --summary=\"...\"",
      "  --since=<ref> --date=YYYY-MM-DD --allow-empty",
      "",
    ].join("\n"),
  );
}

function git(args, { capture = false } = {}) {
  if (capture) {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  }
  const result = spawnSync("git", args, { cwd: root, stdio: "inherit" });
  if (result.error) fail(`git ${args.join(" ")} failed: ${result.error.message}`);
  return result.status ?? 1;
}

function gitCapture(args) {
  try {
    return git(args, { capture: true });
  } catch {
    return null;
  }
}

function runNode(scriptArgs) {
  const result = spawnSync(process.execPath, scriptArgs, { cwd: root, stdio: "inherit" });
  if (result.error) fail(`node ${scriptArgs.join(" ")} failed: ${result.error.message}`);
  return result.status ?? 1;
}

function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(/^(y|yes)$/i.test(answer.trim()));
    });
  });
}

function currentVersion() {
  try {
    const log = JSON.parse(readFileSync(dataPath, "utf8"));
    return log.releases?.[0]?.version ?? null;
  } catch {
    return null;
  }
}

function printReleaseSummary(version) {
  try {
    const log = JSON.parse(readFileSync(dataPath, "utf8"));
    const release = log.releases?.find((entry) => entry.version === version);
    if (!release) return;
    const lines = [`devlog: v${release.version} (${release.changes.length} changes)`];
    if (release.title) lines.push(`  title: ${release.title}`);
    for (const change of release.changes) {
      const scope = change.scope ? `[${change.scope}] ` : "";
      lines.push(`  - ${change.category}: ${scope}${change.summary}`);
    }
    process.stdout.write(`${lines.join("\n")}\n`);
  } catch {
    // The cut step already reported; a summary failure must not block shipping.
  }
}

const rawArgs = process.argv.slice(2).filter((arg, index, all) => arg !== "--" || index !== all.indexOf("--"));
const cutArgs = [];
let remote = "origin";
let fetch = true;
let push = true;
let allowBranch = false;
let sign = false;
let assumeYes = false;
let dryRun = false;

for (let index = 0; index < rawArgs.length; index += 1) {
  const arg = rawArgs[index];
  if (arg === "--help") {
    usage();
    process.exit(0);
  }
  if (arg === "--yes" || arg === "-y") {
    assumeYes = true;
    continue;
  }
  if (arg === "--dry-run") {
    dryRun = true;
    continue;
  }
  if (arg === "--no-push") {
    push = false;
    continue;
  }
  if (arg === "--no-fetch") {
    fetch = false;
    continue;
  }
  if (arg === "--allow-branch") {
    allowBranch = true;
    continue;
  }
  if (arg === "--sign") {
    sign = true;
    continue;
  }
  if (arg === "--remote") {
    const value = rawArgs[index + 1];
    if (!value || value.startsWith("--")) fail("--remote requires a value.");
    remote = value;
    index += 1;
    continue;
  }
  if (arg.startsWith("--remote=")) {
    const value = arg.slice("--remote=".length);
    if (!value) fail("--remote requires a value.");
    remote = value;
    continue;
  }
  const flag = arg.startsWith("--") ? arg.slice(2) : null;
  const [name, ...rest] = flag?.split("=") ?? [];
  const value = rest.length > 0 ? rest.join("=") : null;
  if (name && CUT_FLAGS_BOOLEAN.has(name) && value === null) {
    cutArgs.push(arg);
    continue;
  }
  if (name && CUT_FLAGS_WITH_VALUE.has(name)) {
    // devlog.mjs only parses `--name=value`; normalize `--name value` so both
    // forms work through this passthrough.
    const next = rawArgs[index + 1];
    if (value === null && (!next || next.startsWith("--"))) fail(`${arg} requires a value.`);
    const resolved = value !== null ? value : next;
    cutArgs.push(`--${name}=${resolved}`);
    if (value === null) index += 1;
    continue;
  }
  fail(`unknown option "${arg}". Run with --help to see the supported flags.`);
}

// ------------------------------------------------------------------ prechecks

const branch = gitCapture(["branch", "--show-current"]);
if (!branch) fail("not on a branch (detached HEAD). Check out `main` first.");
if (branch !== "main" && !allowBranch) {
  fail(`on branch "${branch}", not "main". Cut releases from an up-to-date \`main\` checkout, or pass --allow-branch.`);
}

const dirtyReleasePaths = gitCapture(["status", "--porcelain", "--", ...RELEASE_PATHS]);
if (dirtyReleasePaths === null) fail("not a git worktree, or git is unavailable.");
if (dirtyReleasePaths !== "") {
  fail(
    "release files already have uncommitted changes:\n" +
      `${dirtyReleasePaths}\n` +
      "Commit or stash them first so the release commit stays reviewable.",
  );
}

if (gitCapture(["status", "--porcelain"]) !== "") {
  process.stdout.write(
    "release:ship: note: unrelated files have uncommitted changes; they will be left alone — only CHANGELOG.md and packages/devlog are committed.\n",
  );
}

if (fetch) {
  const fetched = git(["fetch", remote, "main", "--quiet"]);
  if (fetched !== 0) {
    process.stdout.write(
      `release:ship: warning: could not fetch ${remote}/main; continuing without the freshness check.\n`,
    );
  }
}

const remoteMain = gitCapture(["rev-parse", "-q", "--verify", `${remote}/main`]);
if (remoteMain) {
  const behind = Number.parseInt(gitCapture(["rev-list", "--count", `HEAD..${remote}/main`]) ?? "0", 10);
  const ahead = Number.parseInt(gitCapture(["rev-list", "--count", `${remote}/main..HEAD`]) ?? "0", 10);
  if (Number.isFinite(behind) && behind > 0) {
    fail(`local ${branch} is ${behind} commit(s) behind ${remote}/main. Pull first, then re-run.`);
  }
  if (Number.isFinite(ahead) && ahead > 0) {
    process.stdout.write(`release:ship: note: ${ahead} local commit(s) not yet on ${remote}/main will ship in this release.\n`);
  }
} else {
  process.stdout.write(`release:ship: note: no ${remote}/main ref found; skipping the freshness check.\n`);
}

// ----------------------------------------------------------------------- cut

if (dryRun) {
  const status = runNode([devlogScript, "preview", ...cutArgs]);
  if (status !== 0) process.exit(status);
  process.stdout.write("\nrelease:ship: dry run — nothing written. Without --dry-run this would: cut, commit, tag, and push.\n");
  process.exit(0);
}

const versionBefore = currentVersion();
const cutStatus = runNode([devlogScript, "cut", ...cutArgs]);
if (cutStatus !== 0) process.exit(cutStatus);

const version = currentVersion();
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  fail("cut succeeded but no new MAJOR.MINOR.PATCH version was found in releases.json.");
}
if (version === versionBefore) {
  fail(`releases.json still at v${version} after cut; refusing to commit an empty release.`);
}

const checkStatus = runNode([devlogScript, "check"]);
if (checkStatus !== 0) {
  fail("generated files are out of sync after cut. Inspect the diff, fix up, and re-run.");
}

printReleaseSummary(version);
const diffStat = gitCapture(["diff", "--stat", "--", ...RELEASE_PATHS]);
if (diffStat) process.stdout.write(`${diffStat}\n`);

const tag = `v${version}`;
const subject = `release: ${tag}`;

// -------------------------------------------------------------------- commit

if (git(["add", "--", ...RELEASE_PATHS]) !== 0) fail("git add of the release files failed.");
if (git(["commit", "-m", subject]) !== 0) {
  fail("git commit failed. The cut files are still staged — inspect with `git status` and retry.");
}

// ----------------------------------------------------------------------- tag

if (gitCapture(["rev-parse", "-q", "--verify", `refs/tags/${tag}`])) {
  fail(`tag ${tag} already exists. The release commit is local — delete it or move the tag deliberately, then re-run.`);
}
const tagArgs = sign ? ["tag", "-s", "-m", subject, tag] : ["tag", "-a", "-m", subject, tag];
if (git(tagArgs) !== 0) {
  fail(`git tag ${tag} failed. The release commit is local — inspect with \`git status\` and retry.`);
}
process.stdout.write(`release:ship: committed "${subject}" and tagged ${tag}.\n`);

// ---------------------------------------------------------------------- push

const pushBranch = async () => {
  if (!push) {
    process.stdout.write(
      [
        "release:ship: --no-push: nothing pushed. To ship later:",
        `  git push ${remote} ${branch}`,
        `  git push ${remote} ${tag}`,
        "",
        `Pushing the tag starts the Production Deploy workflow for ${tag}.`,
        "",
      ].join("\n"),
    );
    return;
  }

  if (!assumeYes) {
    const ok = await confirm(`Commit and tag ${tag} locally. Push ${branch} + ${tag} to ${remote} and start production deploy? [y/N] `);
    if (!ok) {
      process.stdout.write(
        [
          "release:ship: kept the commit and tag locally; nothing pushed.",
          `  git push ${remote} ${branch} && git push ${remote} ${tag}   # ship later`,
          `  git reset --soft HEAD~1 && git tag -d ${tag}                # undo instead`,
          "",
        ].join("\n"),
      );
      process.exit(1);
    }
  }

  if (git(["push", remote, branch]) !== 0) {
    process.stderr.write(
      [
        `release:ship: pushing ${branch} to ${remote} failed — the tag was NOT pushed.`,
        "If branch protection rejected a direct push, ship through a PR instead:",
        `  git push ${remote} HEAD:release/cd-${version}`,
        `  # open a PR, merge it, then move the tag to the merged commit:`,
        `  git tag -d ${tag}`,
        `  git fetch ${remote} main`,
        `  git tag -a -m "${subject}" ${tag} ${remote}/main`,
        `  git push ${remote} ${tag}`,
        "",
      ].join("\n"),
    );
    process.exit(1);
  }
  if (git(["push", remote, tag]) !== 0) {
    process.stderr.write(
      `release:ship: pushing tag ${tag} failed. The release commit is on ${remote}/${branch}; retry with \`git push ${remote} ${tag}\`.\n`,
    );
    process.exit(1);
  }
  process.stdout.write(
    `release:ship: shipped ${tag}. Watch the Production Deploy workflow; a failed deploy keeps the tag, so retry via workflow_dispatch with ${tag}.\n`,
  );
};

await pushBranch();
