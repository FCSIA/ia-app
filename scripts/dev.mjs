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
if (mode !== "shared") {
  // A phone-testing LAN host goes stale when the machine changes networks,
  // and the web app then times out reaching Convex. Re-point the clients
  // first; this never stops the dev servers from starting.
  spawnSync(process.execPath, [join(root, "scripts", "sync-convex-env.mjs"), "--heal"], {
    cwd: root,
    stdio: "inherit",
  });
}
const result = spawnSync("pnpm", ["exec", "turbo", "run", "dev", ...filters], {
  cwd: root,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
