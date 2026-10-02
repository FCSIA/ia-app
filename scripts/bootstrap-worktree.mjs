import { existsSync, lstatSync, mkdirSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2).filter((arg, index) => arg !== "--" || index !== 0);
const envPaths = [];
let source;
let linkDependencies = true;
let convexMode = "isolated";
let replaceSymlinks = false;
let dryRun = false;

const usage = () => {
  console.log(`Usage: bun run worktree:bootstrap -- [options]

Link reusable local setup from the primary worktree into this worktree.

Options:
  --from <path>            Source worktree (default: Git's primary worktree)
  --env <relative-path>    Link a local environment file; may be repeated
  --no-dependencies        Do not install local node_modules directories
  --shared-convex          Reuse the primary worktree's local Convex backend
  --isolated-convex        Create a separate local Convex backend (the default)
  --no-convex              Do not configure a Convex backend
  --replace-symlinks       Repoint existing symlinks (never replaces files)
  --dry-run                Print changes without making them
  --help                   Show this help

By default, this worktree receives an isolated local Convex backend. Shared
Convex mode is explicit because it shares data and deployed function code.`);
};

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--help") {
    usage();
    process.exit(0);
  }
  if (arg === "--from" || arg === "--env") {
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${arg} requires a value.`);
    }
    if (arg === "--from") source = value;
    else envPaths.push(value);
    index += 1;
    continue;
  }
  if (arg === "--no-dependencies") {
    linkDependencies = false;
    continue;
  }
  if (arg === "--isolated-convex") {
    convexMode = "isolated";
    continue;
  }
  if (arg === "--shared-convex") {
    convexMode = "shared";
    continue;
  }
  if (arg === "--no-convex") {
    convexMode = "none";
    continue;
  }
  if (arg === "--replace-symlinks") {
    replaceSymlinks = true;
    continue;
  }
  if (arg === "--dry-run") {
    dryRun = true;
    continue;
  }
  throw new Error(`Unknown option: ${arg}`);
}

const primaryWorktree = () => {
  const result = spawnSync("git", ["worktree", "list", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error("Could not determine Git worktrees.");
  const line = result.stdout.split("\n").find((value) => value.startsWith("worktree "));
  if (!line) throw new Error("Git did not report a primary worktree.");
  return line.slice("worktree ".length);
};

const sourceRoot = realpathSync(resolve(root, source ?? primaryWorktree()));
if (sourceRoot === root) {
  throw new Error("The source worktree must be different from this worktree.");
}

const toRelativePath = (value) => {
  if (!value || value.startsWith("-") || value.includes("\0")) {
    throw new Error(`Invalid path: ${value}`);
  }
  const destination = resolve(root, value);
  if (destination !== root && !destination.startsWith(`${root}${sep}`)) {
    throw new Error(`Path must stay inside this worktree: ${value}`);
  }
  return relative(root, destination);
};

const sharedLocalPaths = [
  ".env.local",
  "apps/convex/.env.local",
  "apps/convex/.convex/local/default",
  "apps/web/.env.local",
  "apps/mobile/.env.local",
];
const sharedBackendPaths = sharedLocalPaths.filter((path) => path !== ".env.local");
const requestedEnvPaths = envPaths.map(toRelativePath);
if (convexMode === "isolated" && requestedEnvPaths.some((path) => sharedBackendPaths.includes(path))) {
  throw new Error("An isolated backend cannot share local Convex environment or state files.");
}
if (convexMode === "none" && requestedEnvPaths.some((path) => path.startsWith("apps/convex/"))) {
  throw new Error("--no-convex cannot link Convex deployment state.");
}
if (convexMode === "shared") {
  for (const path of ["apps/convex/.env.local", "apps/convex/.convex/local/default"]) {
    if (!existsSync(join(sourceRoot, path))) {
      throw new Error(`Source worktree is missing ${path}. Use --isolated-convex instead.`);
    }
  }
}

const link = (relativePath) => {
  const sourcePath = join(sourceRoot, relativePath);
  const destinationPath = join(root, relativePath);
  if (!existsSync(sourcePath)) {
    console.log(`Skipped ${relativePath}: not present in source worktree.`);
    return;
  }

  if (existsSync(destinationPath) || (() => {
    try {
      return lstatSync(destinationPath).isSymbolicLink();
    } catch {
      return false;
    }
  })()) {
    const stat = lstatSync(destinationPath);
    if (!stat.isSymbolicLink()) {
      throw new Error(`Refusing to replace existing ${relativePath}. Move it aside or choose another option.`);
    }
    const currentTarget = realpathSync(destinationPath);
    if (currentTarget === realpathSync(sourcePath)) {
      console.log(`Kept ${relativePath}: already linked to source worktree.`);
      return;
    }
    if (!replaceSymlinks) {
      throw new Error(`${relativePath} is already a symlink. Re-run with --replace-symlinks to repoint it.`);
    }
    if (!dryRun) unlinkSync(destinationPath);
  }

  console.log(`${dryRun ? "Would link" : "Linked"} ${relativePath} -> ${sourcePath}`);
  if (!dryRun) {
    mkdirSync(dirname(destinationPath), { recursive: true });
    symlinkSync(relative(dirname(destinationPath), sourcePath), destinationPath);
  }
};

const removeSharedLink = (relativePath) => {
  const destinationPath = join(root, relativePath);
  const sourcePath = join(sourceRoot, relativePath);
  try {
    if (
      lstatSync(destinationPath).isSymbolicLink() &&
      realpathSync(destinationPath) === realpathSync(sourcePath)
    ) {
      if (!dryRun) unlinkSync(destinationPath);
      console.log(`${dryRun ? "Would remove" : "Removed"} shared ${relativePath} link.`);
    }
  } catch {
    // Missing paths and links to other locations are intentionally left alone.
  }
};

const modePath = join(root, ".worktree-bootstrap.json");
if (convexMode !== "shared") {
  for (const path of sharedLocalPaths) removeSharedLink(path);
  if (existsSync(modePath)) {
    if (!dryRun) unlinkSync(modePath);
    console.log(`${dryRun ? "Would remove" : "Removed"} shared worktree mode marker.`);
  }
}

const removeSourceNodeModulesLink = (relativePath) => {
  const destinationPath = join(root, relativePath);
  const sourcePath = join(sourceRoot, relativePath);
  try {
    if (
      lstatSync(destinationPath).isSymbolicLink() &&
      realpathSync(destinationPath) === realpathSync(sourcePath)
    ) {
      if (!dryRun) unlinkSync(destinationPath);
      console.log(`${dryRun ? "Would remove" : "Removed"} unsupported shared ${relativePath} symlink.`);
    }
  } catch {
    // A missing dependency directory is expected before the local install.
  }
};

if (linkDependencies) {
  for (const path of [
    "node_modules",
    "apps/convex/node_modules",
    "apps/mobile/node_modules",
    "apps/web/node_modules",
    "packages/design-tokens/node_modules",
    "packages/devlog/node_modules",
    "packages/fun-facts/node_modules",
  ]) {
    removeSourceNodeModulesLink(path);
  }
  if (dryRun) {
    console.log("Would install local node_modules from Bun's shared package cache.");
  } else {
    const result = spawnSync("bun", ["install", "--frozen-lockfile"], {
      cwd: root,
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

const localPaths = convexMode === "shared"
  ? [...new Set([...sharedLocalPaths, ...requestedEnvPaths])]
  : requestedEnvPaths;
for (const path of localPaths) {
  link(path);
}

if (convexMode === "shared") {
  if (dryRun) {
    console.log("Would mark this worktree to start only the web server with bun run dev.");
  } else {
    writeFileSync(modePath, `${JSON.stringify({ convex: "shared" })}\n`, "utf8");
    console.log("Shared Convex mode: bun run dev will start only the web server.");
  }
}

if (convexMode === "isolated") {
  if (dryRun) {
    console.log("Would create/select this worktree's isolated local Convex backend.");
  } else {
    if (!existsSync(join(root, "node_modules", "convex"))) {
      throw new Error("Local Convex setup requires dependencies. Run bun install or omit --no-dependencies.");
    }
    const result = spawnSync(process.execPath, [join(root, "scripts", "setup-convex-local.mjs")], {
      cwd: root,
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
