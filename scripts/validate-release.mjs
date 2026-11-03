#!/usr/bin/env node

// Validate the checked-out release commit without dependencies or credentials.
import { execFileSync } from "node:child_process";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
function requireRelease(condition, message) {
  if (!condition) throw new Error(message);
}

const sha = process.argv[2];
requireRelease(/^[0-9a-f]{40}$/.test(sha ?? ""), "A full release commit SHA is required.");
requireRelease(git("rev-parse", "HEAD") === sha, "Checkout does not match the release commit.");
git("merge-base", "--is-ancestor", sha, "origin/main");
const parents = git("show", "-s", "--format=%P", sha).split(" ");
requireRelease(parents.length === 1 && parents[0], "A release must be a single-parent commit.");
const parent = parents[0];
const base = git("show", "-s", "--format=%(trailers:key=Release-Base,valueonly)", sha);
requireRelease(base === parent, "Release-Base must match the release commit's parent.");

const dataPath = "packages/devlog/data/releases.json";
const current = JSON.parse(git("show", `${sha}:${dataPath}`));
const previous = JSON.parse(git("show", `${parent}:${dataPath}`));
const version = current.releases?.[0]?.version;
requireRelease(/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(version ?? ""), "Invalid release version.");
const tag = `v${version}`;
requireRelease(git("show", "-s", "--format=%s", sha) === `release: ${tag}`, "Release commit subject must match the version.");
requireRelease(
  JSON.stringify({ ...current, releases: current.releases.slice(1) }) === JSON.stringify(previous),
  "A release must prepend exactly one version and preserve the existing release log.",
);
const before = previous.releases[0].version.split(".").map(BigInt);
const after = version.split(".").map(BigInt);
const differing = after.findIndex((part, index) => part !== before[index]);
requireRelease(differing >= 0 && after[differing] > before[differing], "Release version must increase.");

const allowed = new Set([dataPath, "packages/devlog/src/releases.generated.ts", "CHANGELOG.md"]);
const changed = git("diff-tree", "--no-commit-id", "--name-only", "-r", sha).split("\n");
requireRelease(changed.includes(dataPath) && changed.every((file) => allowed.has(file)), "A release commit may only change the release log and its generated files.");
process.stdout.write(`${tag}\n`);
