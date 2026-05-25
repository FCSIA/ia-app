#!/usr/bin/env node
/**
 * Convex dev data orchestration (replaces Prisma db:reset / full db:seed).
 * Requires BOOTSTRAP_SECRET in the environment (Convex deployment env).
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const convexDir = path.join(repoRoot, "apps/convex");
const secret = process.env.BOOTSTRAP_SECRET ?? process.env.COURSE_SEED_SECRET;

function run(functionPath, args) {
  const payload = JSON.stringify(args).replace(/'/g, "'\\''");
  execSync(
    `cd "${convexDir}" && PATH="${path.join(repoRoot, "node_modules/.bin")}:$PATH" convex run ${functionPath} '${payload}'`,
    { stdio: "inherit", env: process.env },
  );
}

function requireSecret() {
  if (!secret) {
    console.error("Set BOOTSTRAP_SECRET (or COURSE_SEED_SECRET) before running db commands.");
    process.exit(1);
  }
  return secret;
}

const command = process.argv[2] ?? "seed";

if (command === "reset") {
  requireSecret();
  console.log("Resetting Convex demo data (users, courses, schedule blocks/friends)...");
  run("bootstrap:resetAndSeed", { secret, reset: true });
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
        { encoding: "utf8", env: process.env },
      ),
    );
    isDone = result.isDone === true;
    cursor = result.nextCursor;
    guard += 1;
  }
  console.log("Convex reset + seed complete.");
} else if (command === "seed") {
  requireSecret();
  console.log("Running full Convex seed (bootstrap + courses + schedule)...");
  run("bootstrap:resetAndSeed", { secret, reset: false });
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
      { encoding: "utf8", env: process.env },
    );
    const result = JSON.parse(out);
    isDone = result.isDone === true;
    cursor = result.nextCursor;
    guard += 1;
  }
  console.log("Convex seed complete.");
} else if (command === "bootstrap") {
  requireSecret();
  run("bootstrap:resetAndSeed", { secret, reset: process.argv.includes("--reset") });
} else {
  console.error(`Unknown command: ${command}. Use: reset | seed | bootstrap`);
  process.exit(1);
}
