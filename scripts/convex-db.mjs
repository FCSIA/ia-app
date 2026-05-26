#!/usr/bin/env node
/**
 * Convex dev data orchestration (replaces Prisma db:reset / full db:seed).
 * Requires BOOTSTRAP_SECRET in the environment (Convex deployment env).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const convexDir = path.join(repoRoot, "apps/convex");

function loadEnvFile(filePath, options = {}) {
  const overrideKeys = new Set(options.overrideKeys ?? []);
  if (!fs.existsSync(filePath)) {
    return;
  }
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match || (process.env[match[1]] !== undefined && !overrideKeys.has(match[1]))) {
      continue;
    }
    process.env[match[1]] = parseEnvValue(match[2]);
  }
}

function parseEnvValue(rawValue) {
  const trimmed = rawValue.trim();
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    return trimmed.replace(/^(['"])(.*)\1(?:\s+#.*)?$/, "$2").trim();
  }
  return trimmed.replace(/\s+#.*$/, "").trim();
}

loadEnvFile(path.join(repoRoot, ".env"));
loadEnvFile(path.join(convexDir, ".env.local"), {
  overrideKeys: ["CONVEX_DEPLOYMENT", "CONVEX_URL", "CONVEX_SITE_URL"],
});

for (const key of [
  "CONVEX_DEPLOYMENT",
  "CONVEX_DEPLOY_KEY",
  "BOOTSTRAP_SECRET",
  "COURSE_SEED_SECRET",
  "SCHEDULE_SEED_SECRET",
]) {
  if (process.env[key] !== undefined) {
    process.env[key] = process.env[key].trim();
  }
}

const secret = process.env.BOOTSTRAP_SECRET ?? process.env.COURSE_SEED_SECRET;

const childEnv = {
  ...process.env,
  CONVEX_DEPLOYMENT: process.env.CONVEX_DEPLOYMENT,
  CONVEX_URL: process.env.CONVEX_URL,
  CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
};

function run(functionPath, args) {
  const payload = JSON.stringify(args).replace(/'/g, "'\\''");
  execSync(
    `cd "${convexDir}" && PATH="${path.join(repoRoot, "node_modules/.bin")}:$PATH" convex run ${functionPath} '${payload}'`,
    { stdio: "inherit", env: childEnv },
  );
}

function runJson(functionPath, args) {
  const payload = JSON.stringify(args).replace(/'/g, "'\\''");
  return JSON.parse(
    execSync(
      `cd "${convexDir}" && PATH="${path.join(repoRoot, "node_modules/.bin")}:$PATH" convex run ${functionPath} '${payload}'`,
      { encoding: "utf8", env: childEnv },
    ),
  );
}

function runBootstrap({ reset }) {
  let cursor = undefined;
  let isDone = false;
  let resetPending = reset;
  let guard = 0;
  while (!isDone && guard < 50) {
    const result = runJson("bootstrap:resetAndSeed", {
      secret,
      reset: resetPending,
      cursor: cursor ?? "0",
      batchSize: 1,
    });
    resetPending = result.deleted > 0;
    isDone = result.isDone === true;
    cursor = result.nextCursor;
    guard += 1;
  }
  if (!isDone) {
    throw new Error("Bootstrap seed did not finish within the guard limit.");
  }
}

function requireSecret() {
  if (!secret) {
    console.error("Set BOOTSTRAP_SECRET (or COURSE_SEED_SECRET) before running db commands.");
    process.exit(1);
  }
  return secret;
}

function requireDeployment() {
  if (process.env.CONVEX_DEPLOYMENT || process.env.CONVEX_DEPLOY_KEY) {
    return;
  }
  console.error("Convex is not configured for this checkout.");
  console.error("Run `direnv exec . pnpm convex:dev` once to select/create a dev deployment.");
  console.error("Then set the matching deployment secret, for example:");
  console.error("  cd apps/convex && convex env set BOOTSTRAP_SECRET 42");
  process.exit(1);
}

const command = process.argv[2] ?? "seed";

if (command === "reset") {
  requireSecret();
  requireDeployment();
  console.log("Resetting Convex demo data (users, courses, schedule blocks/friends)...");
  run("courses/seed:run", { secret, reset: true });
  runBootstrap({ reset: true });
  console.log("Seeding student schedules (batched)...");
  let cursor = undefined;
  let isDone = false;
  let guard = 0;
  while (!isDone && guard < 200) {
    const result = JSON.parse(
      execSync(
        `cd "${convexDir}" && PATH="${path.join(repoRoot, "node_modules/.bin")}:$PATH" convex run schedule/seed:seedFromStaticData '${JSON.stringify({
          secret,
          reset: cursor ? false : true,
          cursor: cursor ?? "0",
          batchSize: 20,
        }).replace(/'/g, "'\\''")}'`,
        { encoding: "utf8", env: childEnv },
      ),
    );
    isDone = result.isDone === true;
    cursor = result.nextCursor;
    guard += 1;
  }
  console.log("Convex reset + seed complete.");
} else if (command === "seed") {
  requireSecret();
  requireDeployment();
  console.log("Running full Convex seed (bootstrap + courses + schedule)...");
  runBootstrap({ reset: false });
  run("courses/seed:run", { secret, reset: false });
  let cursor = undefined;
  let isDone = false;
  let guard = 0;
  while (!isDone && guard < 200) {
    const payload = JSON.stringify({
      secret,
      reset: false,
      cursor: cursor ?? "0",
      batchSize: 20,
    }).replace(/'/g, "'\\''");
    const out = execSync(
      `cd "${convexDir}" && PATH="${path.join(repoRoot, "node_modules/.bin")}:$PATH" convex run schedule/seed:seedFromStaticData '${payload}'`,
      { encoding: "utf8", env: childEnv },
    );
    const result = JSON.parse(out);
    isDone = result.isDone === true;
    cursor = result.nextCursor;
    guard += 1;
  }
  console.log("Convex seed complete.");
} else if (command === "clear") {
  requireSecret();
  requireDeployment();
  console.log("Clearing all Convex tables...");
  run("clear:all", { secret });
  console.log("Convex tables cleared.");
} else if (command === "bootstrap") {
  requireSecret();
  requireDeployment();
  runBootstrap({ reset: process.argv.includes("--reset") });
} else {
  console.error(`Unknown command: ${command}. Use: reset | seed | bootstrap`);
  process.exit(1);
}
