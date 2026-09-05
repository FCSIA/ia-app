import { existsSync, lstatSync, mkdirSync, realpathSync, readdirSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2).filter((arg, index) => arg !== "--" || index !== 0);
const envPaths = [];
let source;
let linkDependencies = true;
let convexMode = "shared";
let replaceSymlinks = false;
let dryRun = false;

const usage = () => {
  console.log(`Usage: pnpm worktree:bootstrap -- [options]

Link reusable local setup from the primary worktree into this worktree.

Options:
  --from <path>            Source worktree (default: Git's primary worktree)
  --env <relative-path>    Link a local environment file; may be repeated
  --no-dependencies        Do not link node_modules directories
  --isolated-convex        Create a separate local Convex backend for this worktree
  --no-convex              Do not configure a Convex backend
  --replace-symlinks       Repoint existing symlinks (never replaces files)
  --dry-run                Print changes without making them
  --help                   Show this help

By default, the primary worktree's local Convex configuration is linked. Stop
its Convex watcher before running one in this worktree. Use --isolated-convex
to create a separate backend instead.`);
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

if (linkDependencies) {
  const dependencyPaths = ["node_modules"];
  for (const parent of ["apps", "packages"]) {
    const parentPath = join(root, parent);
    if (!existsSync(parentPath)) continue;
    for (const entry of readdirSync(parentPath, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(parentPath, entry.name, "package.json"))) {
        dependencyPaths.push(join(parent, entry.name, "node_modules"));
      }
    }
  }
  for (const path of dependencyPaths) link(path);
}

const localPaths = convexMode === "shared"
  ? [...new Set([...sharedLocalPaths, ...requestedEnvPaths])]
  : requestedEnvPaths;
for (const path of localPaths) {
  link(path);
}

if (convexMode === "isolated") {
  if (dryRun) {
    console.log("Would create/select this worktree's isolated local Convex backend.");
  } else {
    if (!existsSync(join(root, "node_modules", "convex"))) {
      throw new Error("Local Convex setup requires dependencies. Run pnpm install or omit --no-dependencies.");
    }
    const result = spawnSync(process.execPath, [join(root, "scripts", "setup-convex-local.mjs")], {
      cwd: root,
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
