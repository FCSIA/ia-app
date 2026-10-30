import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const target = args[0] ?? "ios";
if (args.length > 1 || !["ios", "android", "phone"].includes(target)) {
  console.error("Usage: bun run dev:mobile -- [ios|android|phone]");
  process.exit(1);
}

const convexDirectory = join(root, "apps", "convex");
const envPath = join(convexDirectory, ".env.local");
const modePath = join(root, ".worktree-bootstrap.json");
if (existsSync(modePath) && JSON.parse(readFileSync(modePath, "utf8")).convex === "shared") {
  console.error("Use an isolated local backend for mobile development. Run worktree:bootstrap without --shared-convex.");
  process.exit(1);
}
if (!existsSync(envPath) || !/^CONVEX_DEPLOYMENT=["']?local:/m.test(readFileSync(envPath, "utf8"))) {
  console.error("Configure this checkout's local backend with bun run setup:convex-local first.");
  process.exit(1);
}

const run = (command, commandArgs, cwd = root) => {
  const result = spawnSync(command, commandArgs, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const hostArgs = target === "android" ? ["--android"] : ["--host", target === "phone" ? "auto" : "127.0.0.1"];
run(process.execPath, [join(root, "scripts", "sync-convex-env.mjs"), ...hostArgs]);
console.log(`Starting the local backend and Expo development client for ${target}.`);
run("bun", [
  "run", "convex", "dev", "--env-file", envPath,
  "--start", "bun run --cwd ../mobile dev:client",
], convexDirectory);
