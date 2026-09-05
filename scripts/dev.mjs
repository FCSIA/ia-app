import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const modePath = join(root, ".worktree-bootstrap.json");
const mode = existsSync(modePath)
  ? JSON.parse(readFileSync(modePath, "utf8")).convex
  : "isolated";
const filters = mode === "shared" ? ["--filter=web"] : ["--filter=web", "--filter=cvx"];
const result = spawnSync("pnpm", ["exec", "turbo", "run", "dev", ...filters], {
  cwd: root,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
