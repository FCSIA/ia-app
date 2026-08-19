#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (command, args, options = {}) =>
  execFileSync(command, args, { cwd: root, encoding: "utf8", stdio: "inherit", ...options });
const capture = (command, args) => execFileSync(command, args, { cwd: root, encoding: "utf8" }).trim();

function fail(message) {
  process.stderr.write(`release: ${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const releaseFlags = args.filter((arg) => arg === "--minor" || arg === "--patch" || arg.startsWith("--set="));
if (args.some((arg) => arg !== "--dry-run" && !releaseFlags.includes(arg))) {
  fail("supported options are --minor, --set=MAJOR.MINOR.PATCH, and --dry-run");
}
if (releaseFlags.filter((arg) => arg !== "--patch").length > 1) fail("choose one version option");

if (capture("git", ["branch", "--show-current"]) !== "main") fail("run from the main branch");
if (!dryRun && capture("git", ["status", "--porcelain"])) fail("refusing to run with dirty changes");
run("git", ["fetch", "origin", "main", "--tags"]);
const local = capture("git", ["rev-parse", "main"]);
const remote = capture("git", ["rev-parse", "origin/main"]);
if (local !== remote) fail(`local main (${local.slice(0, 7)}) is not synchronized with origin/main (${remote.slice(0, 7)}); update the checkout before calculating a release`);

const previewArgs = ["scripts/devlog.mjs", "preview", ...releaseFlags, "--dry-run"];
const preview = capture("node", previewArgs);
const release = JSON.parse(preview.slice(preview.indexOf("{") , preview.lastIndexOf("}") + 1));
const tag = `v${release.version}`;

if (dryRun) {
  process.stdout.write(`${preview}\n`);
  process.stdout.write("release: dry run; no branch, commit, tag, push, or pull-request mutations performed\n");
  process.exit(0);
}

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
run("node", cutArgs);
run("git", ["add", "packages/devlog/data/releases.json", "packages/devlog/src/releases.generated.ts", "CHANGELOG.md"]);
const staged = capture("git", ["diff", "--cached", "--name-only"]).split("\n").filter(Boolean);
const allowed = new Set(["packages/devlog/data/releases.json", "packages/devlog/src/releases.generated.ts", "CHANGELOG.md"]);
if (staged.length === 0) fail("release generation produced no files");
if (staged.some((file) => !allowed.has(file))) fail(`unexpected staged file: ${staged.find((file) => !allowed.has(file))}`);
run("git", ["commit", "-m", `release: ${tag}`, "-m", `Release-Base: ${local}`]);
run("git", ["push", "--set-upstream", "origin", branch]);
const pr = capture("gh", ["pr", "create", "--base", "main", "--head", branch, "--title", `release: ${tag}`, "--body", `Merging this PR publishes ${tag} automatically.\n\nGenerated from packages/devlog/data/releases.json.`]);
process.stdout.write(`\nRelease PR: ${pr}\nMerging it creates ${tag} and deploys that exact release.\n`);
