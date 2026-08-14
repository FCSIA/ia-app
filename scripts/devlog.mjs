#!/usr/bin/env node
/**
 * Release log tooling.
 *
 *   node scripts/devlog.mjs check              verify generated files are in sync
 *   node scripts/devlog.mjs preview [--since]  show the release that would be cut
 *   node scripts/devlog.mjs cut [options]      cut a release and regenerate
 *
 * `packages/devlog/data/releases.json` is the single source of truth. The
 * generated TypeScript module (consumed by the in-app devlog) and the root
 * `CHANGELOG.md` are both derived from it, so `check` can validate drift
 * without touching git — it works in a shallow CI checkout.
 *
 * `cut` reads commits since the previous release and turns them into changelog
 * entries. Commit subjects follow this repository's `subsystem: change` or
 * `type(scope): change` conventions. A commit can override what the log says
 * about it with git trailers:
 *
 *   Devlog: Students can now import a schedule from a screenshot.
 *   Devlog-category: Added
 *   Devlog-scope: schedule
 *   Devlog: skip
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "packages/devlog/data/releases.json");
const modulePath = path.join(root, "packages/devlog/src/releases.generated.ts");
const changelogPath = path.join(root, "CHANGELOG.md");

const REPO_URL = "https://github.com/virajdas/ia-app";

const CHANGE_CATEGORIES = ["Added", "Improved", "Fixed", "Security", "Internal"];
const RELEASE_CHANNELS = ["alpha", "beta", "stable"];

/** Conventional-commit types this repository actually uses. */
const TYPE_CATEGORY = {
  add: "Added",
  feat: "Added",
  feature: "Added",
  fix: "Fixed",
  bugfix: "Fixed",
  hotfix: "Fixed",
  perf: "Improved",
  refactor: "Improved",
  style: "Improved",
  ui: "Improved",
  design: "Improved",
  security: "Security",
  build: "Internal",
  chore: "Internal",
  ci: "Internal",
  deps: "Internal",
  dev: "Internal",
  docs: "Internal",
  revert: "Internal",
  state: "Internal",
  test: "Internal",
};

/** Verbs that reliably classify a `subsystem: change` subject. */
const ADDED_VERBS = /^(add|allow|introduce|support|expose|enable|create)\b/i;
const FIXED_VERBS = /^(fix|repair|restore|resolve|prevent|correct|avoid|stop|tolerate)\b/i;

// ---------------------------------------------------------------- utilities

function fail(message) {
  process.stderr.write(`devlog: ${message}\n`);
  process.exit(1);
}

/** Compare `MAJOR.MINOR.PATCH`; negative when `a` is older. */
function compareVersions(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** Line endings differ between platforms; compare content, not checkout style. */
function normalize(text) {
  return text.replace(/\r\n/g, "\n");
}

function readIfPresent(filePath) {
  try {
    return normalize(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const [name, ...rest] = arg.slice(2).split("=");
    flags[name] = rest.length > 0 ? rest.join("=") : true;
  }
  return { flags, positional };
}

// ------------------------------------------------------------------ loading

function loadLog() {
  const raw = readIfPresent(dataPath);
  if (raw === null) fail(`missing ${path.relative(root, dataPath)}`);
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`${path.relative(root, dataPath)} is not valid JSON: ${error.message}`);
  }
}

function validate(log) {
  const problems = [];

  if (!RELEASE_CHANNELS.includes(log.channel)) {
    problems.push(`channel must be one of ${RELEASE_CHANNELS.join(", ")}`);
  }
  if (!Array.isArray(log.releases) || log.releases.length === 0) {
    problems.push("releases must be a non-empty array");
    return problems;
  }

  const seen = new Set();
  log.releases.forEach((release, index) => {
    const label = release.version ?? `index ${index}`;
    if (!/^\d+\.\d+\.\d+$/.test(release.version ?? "")) {
      problems.push(`${label}: version must be MAJOR.MINOR.PATCH`);
    }
    if (seen.has(release.version)) problems.push(`${label}: duplicate version`);
    seen.add(release.version);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(release.date ?? "")) {
      problems.push(`${label}: date must be YYYY-MM-DD`);
    }
    if (index > 0) {
      const previous = log.releases[index - 1];
      if (compareVersions(previous.version, release.version) <= 0) {
        problems.push(`${label}: releases must be listed newest first`);
      }
    }
    if (!Array.isArray(release.changes) || release.changes.length === 0) {
      problems.push(`${label}: needs at least one change`);
      return;
    }
    release.changes.forEach((change, changeIndex) => {
      const where = `${label} change ${changeIndex + 1}`;
      if (!CHANGE_CATEGORIES.includes(change.category)) {
        problems.push(`${where}: unknown category ${JSON.stringify(change.category)}`);
      }
      if (typeof change.summary !== "string" || change.summary.trim() === "") {
        problems.push(`${where}: summary is required`);
      }
      if (change.pr !== undefined && !Number.isInteger(change.pr)) {
        problems.push(`${where}: pr must be an integer`);
      }
    });
  });

  return problems;
}

// ---------------------------------------------------------------- rendering

function renderModule(log) {
  const releases = JSON.stringify(log.releases, null, 2);
  return [
    "// Generated by `node scripts/devlog.mjs`. Do not edit by hand.",
    "// Source of truth: packages/devlog/data/releases.json",
    "",
    "import type { Release, ReleaseChannel } from './types';",
    "",
    `export const RELEASE_CHANNEL: ReleaseChannel = '${log.channel}';`,
    "",
    `export const RELEASES: readonly Release[] = ${releases};`,
    "",
  ].join("\n");
}

function renderReferences(change) {
  const references = [];
  if (change.pr) references.push(`[#${change.pr}](${REPO_URL}/pull/${change.pr})`);
  if (change.commit) {
    references.push(`[\`${change.commit}\`](${REPO_URL}/commit/${change.commit})`);
  }
  return references.length > 0 ? ` (${references.join(", ")})` : "";
}

function renderReleaseSection(release, channel) {
  const lines = [`## v${release.version} — ${release.date} (${channel})`, ""];
  if (release.title) lines.push(`**${release.title}**`, "");
  if (release.summary) lines.push(release.summary, "");

  for (const category of CHANGE_CATEGORIES) {
    const changes = release.changes.filter((change) => change.category === category);
    if (changes.length === 0) continue;
    lines.push(`### ${category}`, "");
    for (const change of changes) {
      const scope = change.scope ? `**${change.scope}** — ` : "";
      lines.push(`- ${scope}${change.summary}${renderReferences(change)}`);
    }
    lines.push("");
  }

  return lines;
}

function renderChangelog(log) {
  const lines = [
    "# Changelog",
    "",
    "Every production release of the IA app, newest first.",
    "",
    "<!-- Generated by `pnpm devlog:cut`. Edit packages/devlog/data/releases.json, then",
    "     run `pnpm devlog:check` to regenerate and verify. -->",
    "",
    "The app is versioned `MAJOR.MINOR.PATCH` and ships on the release channel named",
    "in each heading. While the channel is `alpha` the major version stays `0`: a new",
    "capability bumps the minor version, and a fix-only release bumps the patch.",
    "",
    "Entries marked **Internal** are tooling, dependency, and documentation work. They",
    "are recorded here for maintainers and hidden from the in-app devlog.",
    "",
  ];

  for (const release of log.releases) {
    lines.push(...renderReleaseSection(release, log.channel));
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Write both derived files. In check mode nothing is written; the function
 * returns the paths whose on-disk content does not match.
 */
function writeDerived(log, { check }) {
  const outputs = [
    { file: modulePath, content: renderModule(log) },
    { file: changelogPath, content: renderChangelog(log) },
  ];

  const stale = [];
  for (const { file, content } of outputs) {
    if (check) {
      if (readIfPresent(file) !== content) stale.push(path.relative(root, file));
      continue;
    }
    writeFileSync(file, content);
  }
  return stale;
}

// ------------------------------------------------------------ commit intake

function parseTrailers(body) {
  const trailers = {};
  for (const line of body.split("\n")) {
    const match = /^(Devlog(?:-category|-scope)?):\s*(.+)$/i.exec(line.trim());
    if (match) trailers[match[1].toLowerCase()] = match[2].trim();
  }
  return trailers;
}

function categorize(type, summary) {
  if (type && TYPE_CATEGORY[type]) return TYPE_CATEGORY[type];
  if (ADDED_VERBS.test(summary)) return "Added";
  if (FIXED_VERBS.test(summary)) return "Fixed";
  return "Improved";
}

/** Turn one commit into a change entry, or `null` when it should be skipped. */
function toChange(commit) {
  const trailers = parseTrailers(commit.body);
  if (trailers.devlog && trailers.devlog.toLowerCase() === "skip") return null;

  let subject = commit.subject.trim();
  let pr;
  const prMatch = /\s*\(#(\d+)\)\s*$/.exec(subject);
  if (prMatch) {
    pr = Number.parseInt(prMatch[1], 10);
    subject = subject.slice(0, prMatch.index).trim();
  }

  const match = /^(?<prefix>[A-Za-z][\w. +-]*?)(?:\((?<scope>[^)]*)\))?(?<breaking>!)?:\s*(?<rest>.+)$/.exec(
    subject,
  );

  let scope;
  let category;
  let summary;
  let breaking = false;

  if (match) {
    const prefix = match.groups.prefix.toLowerCase();
    breaking = Boolean(match.groups.breaking);
    summary = match.groups.rest.trim();
    if (TYPE_CATEGORY[prefix]) {
      // `fix(schedule): ...` — conventional type with an optional scope.
      scope = match.groups.scope || undefined;
      category = TYPE_CATEGORY[prefix];
    } else {
      // `clubs: ...` — this repository's subsystem-first convention.
      scope = prefix;
      category = categorize(null, summary);
    }
  } else {
    summary = subject;
    category = categorize(null, summary);
  }

  if (trailers.devlog) summary = trailers.devlog;
  if (trailers["devlog-scope"]) scope = trailers["devlog-scope"];
  if (trailers["devlog-category"]) {
    const override = trailers["devlog-category"];
    const resolved = CHANGE_CATEGORIES.find(
      (candidate) => candidate.toLowerCase() === override.toLowerCase(),
    );
    if (!resolved) fail(`commit ${commit.short}: unknown Devlog-category "${override}"`);
    category = resolved;
  }

  summary = summary.charAt(0).toUpperCase() + summary.slice(1);
  if (!/[.!?]$/.test(summary)) summary += ".";

  return {
    category,
    ...(scope ? { scope } : {}),
    summary,
    commit: commit.short,
    ...(pr ? { pr } : {}),
    breaking,
  };
}

function resolveSince(log, flags) {
  if (typeof flags.since === "string") return flags.since;

  const previous = log.releases[0];
  if (previous) {
    const tag = `v${previous.version}`;
    try {
      git(["rev-parse", "-q", "--verify", `${tag}^{commit}`]);
      return tag;
    } catch {
      // The tag may not exist locally (shallow clone, or a release cut before
      // tagging was introduced). Fall back to the recorded commit.
    }
    if (previous.commit) return previous.commit;
  }

  fail("cannot determine a starting point; pass --since=<ref>");
}

function collectChanges(since) {
  // ASCII record/unit separators: a commit body can contain anything else.
  const separator = "\u001e";
  const field = "\u001f";
  const raw = git([
    "log",
    "--no-merges",
    `--format=%h${field}%s${field}%b${separator}`,
    `${since}..HEAD`,
  ]);

  return raw
    .split(separator)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [short, subject = "", body = ""] = entry.split(field);
      return { short, subject, body };
    })
    .map(toChange)
    .filter(Boolean);
}

function nextVersion(current, changes, flags) {
  if (typeof flags.set === "string") {
    if (!/^\d+\.\d+\.\d+$/.test(flags.set)) fail("--set expects MAJOR.MINOR.PATCH");
    return flags.set;
  }

  const [major, minor, patch] = current.split(".").map(Number);
  if (flags.major) return `${major + 1}.0.0`;
  if (flags.minor) return `${major}.${minor + 1}.0`;
  if (flags.patch) return `${major}.${minor}.${patch + 1}`;

  // While the major version is 0 a breaking change is not a major bump; it is
  // still the minor position that signals "this release is not just fixes".
  const notable = changes.some((change) => change.breaking || change.category === "Added");
  return notable ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
}

function buildRelease(log, flags) {
  const since = resolveSince(log, flags);
  const changes = collectChanges(since);

  if (changes.length === 0 && !flags["allow-empty"]) {
    fail(`no changes since ${since}; pass --allow-empty to cut anyway`);
  }

  const current = log.releases[0]?.version ?? "0.0.0";
  const version = nextVersion(current, changes, flags);
  if (compareVersions(version, current) <= 0) {
    fail(`next version ${version} is not newer than ${current}`);
  }

  const head = git(["rev-parse", "--short", "HEAD"]).trim();
  const date = typeof flags.date === "string" ? flags.date : new Date().toISOString().slice(0, 10);

  const ordered = CHANGE_CATEGORIES.flatMap((category) =>
    changes
      .filter((change) => change.category === category)
      .map(({ breaking: _breaking, ...change }) => change),
  );

  return {
    version,
    date,
    ...(typeof flags.title === "string" ? { title: flags.title } : {}),
    ...(typeof flags.summary === "string" ? { summary: flags.summary } : {}),
    commit: head,
    changes: ordered,
  };
}

// ----------------------------------------------------------------- commands

function commandCheck() {
  const log = loadLog();
  const problems = validate(log);
  if (problems.length > 0) {
    fail(`invalid releases.json\n  - ${problems.join("\n  - ")}`);
  }

  const stale = writeDerived(log, { check: true });
  if (stale.length > 0) {
    fail(
      `generated files are out of date:\n  - ${stale.join("\n  - ")}\n` +
        "  run `pnpm devlog:generate` and commit the result",
    );
  }

  process.stdout.write(
    `devlog: v${log.releases[0].version} (${log.channel}), ${log.releases.length} releases, generated files in sync\n`,
  );
}

function commandGenerate() {
  const log = loadLog();
  const problems = validate(log);
  if (problems.length > 0) {
    fail(`invalid releases.json\n  - ${problems.join("\n  - ")}`);
  }
  writeDerived(log, { check: false });
  process.stdout.write(`devlog: regenerated from v${log.releases[0].version}\n`);
}

function commandCut(flags, { previewOnly }) {
  const log = loadLog();
  const release = buildRelease(log, flags);

  if (previewOnly || flags["dry-run"]) {
    process.stdout.write(`${JSON.stringify(release, null, 2)}\n\n`);
    process.stdout.write(`${renderReleaseSection(release, log.channel).join("\n")}\n`);
    return;
  }

  const next = { ...log, releases: [release, ...log.releases] };
  const problems = validate(next);
  if (problems.length > 0) {
    fail(`refusing to cut an invalid release\n  - ${problems.join("\n  - ")}`);
  }

  writeFileSync(dataPath, `${JSON.stringify(next, null, 2)}\n`);
  writeDerived(next, { check: false });

  process.stdout.write(
    [
      `devlog: cut v${release.version} (${release.changes.length} changes)`,
      "",
      "Next:",
      "  git add CHANGELOG.md packages/devlog",
      `  git commit -m "release: v${release.version}"`,
      `  git tag v${release.version}`,
      "",
    ].join("\n"),
  );
}

// -------------------------------------------------------------------- entry

const { flags, positional } = parseArgs(process.argv.slice(2));
const command = positional[0] ?? "check";

switch (command) {
  case "check":
    commandCheck();
    break;
  case "generate":
    commandGenerate();
    break;
  case "preview":
    commandCut(flags, { previewOnly: true });
    break;
  case "cut":
    commandCut(flags, { previewOnly: false });
    break;
  default:
    fail(`unknown command "${command}"; expected check, generate, preview, or cut`);
}
