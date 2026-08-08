import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const convexDir = join(root, "apps", "convex");
const convexEnvPath = join(convexDir, ".env.local");
const localConfigPath = join(
  convexDir,
  ".convex",
  "local",
  "default",
  "config.json",
);

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (options.capture) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    process.exit(result.status ?? 1);
  }

  return result.stdout?.trim() ?? "";
};

const convex = (args, options) =>
  run("convex", args, { cwd: convexDir, ...options });

if (existsSync(localConfigPath)) {
  convex(["deployment", "select", "local"]);
} else {
  convex(["deployment", "create", "local", "--select"]);
}

const localConfig = JSON.parse(readFileSync(localConfigPath, "utf8"));
const cloudPort = localConfig.ports?.cloud;
const sitePort = localConfig.ports?.site;

if (!Number.isInteger(cloudPort) || !Number.isInteger(sitePort)) {
  console.error(
    `Invalid local Convex port configuration in ${localConfigPath}`,
  );
  process.exit(1);
}

const upsert = (content, key, value) => {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  return pattern.test(content)
    ? content.replace(pattern, line)
    : `${content.trimEnd()}\n${line}\n`;
};

let convexEnv = readFileSync(convexEnvPath, "utf8");
convexEnv = upsert(convexEnv, "CONVEX_URL", `http://127.0.0.1:${cloudPort}`);
convexEnv = upsert(
  convexEnv,
  "CONVEX_SITE_URL",
  `http://127.0.0.1:${sitePort}`,
);
writeFileSync(
  convexEnvPath,
  convexEnv.endsWith("\n") ? convexEnv : `${convexEnv}\n`,
  "utf8",
);

const getDeploymentEnv = (name) =>
  convex(["env", "get", "--deployment", "local", name], { capture: true });

if (!getDeploymentEnv("BETTER_AUTH_SECRET")) {
  convex([
    "env",
    "set",
    "--deployment",
    "local",
    "BETTER_AUTH_SECRET",
    randomBytes(32).toString("hex"),
  ]);
  console.log("Generated BETTER_AUTH_SECRET for the local deployment.");
} else {
  console.log("Preserved the existing local BETTER_AUTH_SECRET.");
}

if (!getDeploymentEnv("SITE_URL")) {
  convex([
    "env",
    "set",
    "--deployment",
    "local",
    "SITE_URL",
    "http://localhost:3000",
  ]);
  console.log("Set SITE_URL=http://localhost:3000 for the local deployment.");
} else {
  console.log("Preserved the existing local SITE_URL.");
}

run(process.execPath, [join(root, "scripts", "sync-convex-env.mjs")]);
console.log("Local Convex setup is ready. Run `pnpm dev` to start the app.");
