#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseReleaseArgs } from "./release-args.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (command, args, options = {}) =>
  execFileSync(command, args, { cwd: root, encoding: "utf8", stdio: "inherit", ...options });
const capture = (command, args) => execFileSync(command, args, { cwd: root, encoding: "utf8" }).trim();

function fail(message) {
  process.stderr.write(`release: ${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
let dryRun;
let releaseFlags;
try {
  ({ dryRun, releaseFlags } = parseReleaseArgs(args));
} catch (error) {
  fail(error.message);
}

if (capture("git", ["branch", "--show-current"]) !== "main") fail("run from the main branch");
if (!dryRun && capture("git", ["status", "--porcelain"])) fail("refusing to run with dirty changes");
if (!dryRun) run("git", ["fetch", "origin", "main", "--tags"]);
const local = capture("git", ["rev-parse", "main"]);
// A dry run checks the server without fetching branches or tags into the checkout.
const remote = dryRun
  ? capture("git", ["ls-remote", "origin", "refs/heads/main"]).split(/\s+/)[0]
  : capture("git", ["rev-parse", "origin/main"]);
if (!remote) fail("could not resolve origin/main");
if (local !== remote) fail(`local main (${local.slice(0, 7)}) is not synchronized with origin/main (${remote.slice(0, 7)}); update the checkout before calculating a release`);

if (dryRun) {
  run(process.execPath, ["scripts/devlog.mjs", "preview", ...releaseFlags]);
  process.stdout.write("release: dry run; no branch, commit, tag, push, or pull-request mutations performed\n");
  process.exit(0);
}

const preview = capture(process.execPath, ["scripts/devlog.mjs", "preview", ...releaseFlags, "--json"]);
const release = JSON.parse(preview);
const tag = `v${release.version}`;

try {
  capture("git", ["show-ref", "--verify", "--quiet", `refs/tags/${tag}`]);
  fail(`${tag} already exists`);
} catch (error) {
  if (error.status !== 1) throw error;
}

const branch = `release/${tag}`;
try {
  capture("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
  fail(`${branch} already exists`);
} catch (error) {
  if (error.status !== 1) throw error;
}
try {
  capture("git", ["ls-remote", "--exit-code", "--heads", "origin", branch]);
  fail(`${branch} already exists on origin`);
} catch (error) {
  if (error.status !== 2) throw error;
}

run("git", ["switch", "-c", branch]);
const cutArgs = ["scripts/devlog.mjs", "cut", ...releaseFlags];
run(process.execPath, cutArgs);
run("git", ["add", "packages/devlog/data/releases.json", "packages/devlog/src/releases.generated.ts", "CHANGELOG.md"]);
const staged = capture("git", ["diff", "--cached", "--name-only"]).split("\n").filter(Boolean);
const allowed = new Set(["packages/devlog/data/releases.json", "packages/devlog/src/releases.generated.ts", "CHANGELOG.md"]);
if (staged.length === 0) fail("release generation produced no files");
if (staged.some((file) => !allowed.has(file))) fail(`unexpected staged file: ${staged.find((file) => !allowed.has(file))}`);
run("git", ["commit", "-m", `release: ${tag}`, "-m", `Release-Base: ${local}`]);
run("git", ["push", "--set-upstream", "origin", branch]);
const directory = mkdtempSync(path.join(tmpdir(), "ia-release-"));
try {
  const bodyPath = path.join(directory, "body.md");
  writeFileSync(bodyPath, `Merging this PR publishes ${tag} automatically.\n\nGenerated from packages/devlog/data/releases.json.\n`);
  const pr = capture("gh", ["pr", "create", "--base", "main", "--head", branch, "--title", `release: ${tag}`, "--body-file", bodyPath]);
  process.stdout.write(`\nRelease PR: ${pr}\nMerging it creates ${tag} and deploys that exact release.\n`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
