#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const lockfilePath = new URL("../bun.lock", import.meta.url);
const supportedLockfileVersions = [1, 3];

function fail(message) {
  throw new Error(`Production audit inventory: ${message}`);
}

function parseLockfile(text) {
  let lockfile;
  try {
    // Bun's pinned lockfile format is JSON with trailing commas.
    lockfile = JSON.parse(text.replace(/,\s*([}\]])/g, "$1"));
  } catch (error) {
    fail(`cannot parse bun.lock (${error.message})`);
  }

  if (!supportedLockfileVersions.includes(lockfile.lockfileVersion)) {
    fail(
      `unsupported lockfileVersion ${lockfile.lockfileVersion}; expected ${supportedLockfileVersions.join(" or ")}`,
    );
  }
  if (!lockfile.workspaces || typeof lockfile.workspaces !== "object") {
    fail("missing workspaces");
  }
  if (!lockfile.packages || typeof lockfile.packages !== "object") {
    fail("missing packages");
  }
  return lockfile;
}

function splitPackageId(id) {
  if (typeof id !== "string") fail("package entry has no resolved package id");
  const at = id.startsWith("@") ? id.indexOf("@", 1) : id.indexOf("@");
  if (at < 1 || at === id.length - 1) {
    fail(`invalid resolved package id ${id}`);
  }
  return [id.slice(0, at), id.slice(at + 1)];
}

function packageEntries(lockfile) {
  return Object.entries(lockfile.packages).flatMap(([key, value]) => {
    if (!Array.isArray(value) || value.length < 1) {
      fail(`unsupported package entry shape for ${key}`);
    }
    const [name, version] = splitPackageId(value[0]);
    if (version.startsWith("workspace:")) return [];
    if (value.length < 3 || !value[2] || typeof value[2] !== "object") {
      fail(`unsupported package entry shape for ${key}`);
    }
    return { key, name, version, metadata: value[2] };
  });
}

function requestedPackage(name, requested) {
  if (typeof requested !== "string") {
    fail(`dependency ${name} has no requested range`);
  }
  if (requested.startsWith("workspace:")) return { workspace: true };
  if (!requested.startsWith("npm:")) return { name, requested };
  const [aliasName, aliasVersion] = splitPackageId(requested.slice(4));
  return { name: aliasName, requested: aliasVersion, alias: true };
}

function resolvePackage(entriesByKey, entriesByName, parentKey, name, requested) {
  const request = requestedPackage(name, requested);
  if (request.workspace) return null;

  // Bun's lock key records the exact parent/alias instance when a package is
  // nested or aliased. Prefer that authoritative edge before hoisted entries.
  const preferred = [
    entriesByKey.get(`${parentKey}/${name}`),
    entriesByKey.get(name),
  ].filter(Boolean);
  const exactPreferred = preferred.find(
    (entry) =>
      (!request.alias || entry.name === request.name) &&
      entry.version === request.requested,
  );
  if (exactPreferred) return exactPreferred;

  const byName = entriesByName.get(request.name) ?? [];
  const exact = byName.find((entry) => entry.version === request.requested);
  if (exact) return exact;

  // Non-exact ranges are resolved by Bun to the hoisted lock entry. Never
  // guess among multiple versions: an unsupported shape must fail closed.
  const hoisted = preferred.find(
    (entry) => !request.alias || entry.name === request.name,
  );
  if (
    hoisted &&
    !request.requested.includes("*") &&
    request.requested !== "latest"
  ) {
    return hoisted;
  }
  if (hoisted) return hoisted;
  fail(`cannot resolve ${name}@${requested} from ${parentKey || "workspace root"}`);
}

export async function buildProductionInventory(lockfileText) {
  const lockfile = parseLockfile(lockfileText);
  const entries = packageEntries(lockfile);
  const entriesByKey = new Map(entries.map((entry) => [entry.key, entry]));
  const entriesByName = new Map();
  for (const entry of entries) {
    const group = entriesByName.get(entry.name) ?? [];
    group.push(entry);
    entriesByName.set(entry.name, group);
  }

  const workspaceByName = new Map(
    Object.entries(lockfile.workspaces).map(([workspacePath, workspace]) => {
      if (!workspace || typeof workspace !== "object") {
        fail(`invalid workspace ${workspacePath}`);
      }
      return [
        workspace.name ?? (workspacePath === "" ? "ia-app" : workspacePath),
        { workspacePath, workspace },
      ];
    }),
  );

  const enqueue = (queue, name, requested, path, parentKey = "") => {
    const workspace = workspaceByName.get(name);
    if (workspace && requested?.startsWith("workspace:")) {
      queue.push({
        id: `workspace:${workspace.workspacePath}`,
        key: `workspace:${workspace.workspacePath}`,
        name,
        version: "workspace",
        metadata: workspace.workspace,
        path: [...path, name],
      });
      return;
    }
    const entry = resolvePackage(
      entriesByKey,
      entriesByName,
      parentKey,
      name,
      requested,
    );
    queue.push({ ...entry, id: entry.key, path: [...path, entry.name] });
  };

  // First establish the runtime closure using only required dependency edges.
  // An optional package is runtime-selected only when its resolved instance is
  // independently present in that closure.
  const requiredQueue = [];
  for (const workspace of Object.values(lockfile.workspaces)) {
    for (const [name, requested] of Object.entries(
      workspace.dependencies ?? {},
    )) {
      enqueue(requiredQueue, name, requested, []);
    }
  }
  const requiredIds = new Set();
  while (requiredQueue.length) {
    const current = requiredQueue.shift();
    if (requiredIds.has(current.id)) continue;
    requiredIds.add(current.id);
    for (const [name, requested] of Object.entries(
      current.metadata.dependencies ?? {},
    )) {
      enqueue(requiredQueue, name, requested, current.path, current.key);
    }
  }

  const queue = [];
  const seen = new Map();
  for (const workspace of Object.values(lockfile.workspaces)) {
    for (const [name, requested] of Object.entries(
      workspace.dependencies ?? {},
    )) {
      enqueue(queue, name, requested, []);
    }
  }

  while (queue.length) {
    const current = queue.shift();
    const paths = seen.get(current.id) ?? [];
    if (
      paths.some((path) => path.join("\0") === current.path.join("\0"))
    ) {
      continue;
    }
    if (paths.length >= 1000) {
      fail(`too many paths for ${current.id}; graph shape is unsupported`);
    }
    paths.push(current.path);
    seen.set(current.id, paths);

    // A resolved lock instance has one dependency set. Traverse it once even
    // when several roots reach it; retain incoming paths for audit evidence.
    if (paths.length > 1) continue;

    for (const [name, requested] of Object.entries(
      current.metadata.dependencies ?? {},
    )) {
      enqueue(queue, name, requested, current.path, current.key);
    }
    for (const [name, requested] of Object.entries(
      current.metadata.optionalDependencies ?? {},
    )) {
      const optionalQueue = [];
      enqueue(optionalQueue, name, requested, current.path, current.key);
      const optional = optionalQueue[0];
      if (optional && requiredIds.has(optional.id)) queue.push(optional);
    }
    // Peer declarations are constraints, not graph edges. In this pinned Bun
    // lock, resolved peers appear as optional edges; only independently
    // selected instances enter the runtime closure above.
  }

  const packages = [];
  for (const [id, paths] of seen) {
    const current = entriesByKey.get(id);
    if (!current || current.version === "workspace") continue;

    packages.push({
      package: {
        name: current.name,
        version: current.version,
        ecosystem: "npm",
      },
      groups: paths.map((path) => ({ ids: [path.join(" > ")] })),
    });
  }

  return { results: [{ source: { path: "bun.lock" }, packages }] };
}

export function buildFullInventory(lockfileText) {
  const entries = packageEntries(parseLockfile(lockfileText));
  return {
    results: [{
      source: { path: "bun.lock" },
      packages: entries.map(({ key, name, version }) => ({
        package: { name, version, ecosystem: "npm" },
        groups: [{ ids: [key] }],
      })),
    }],
  };
}

async function main() {
  const outputIndex = process.argv.indexOf("--output");
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
  if (!output) {
    throw new Error(
      "Usage: node scripts/audit-production.mjs [--all] --output <file>",
    );
  }

  const buildInventory = process.argv.includes("--all")
    ? buildFullInventory
    : buildProductionInventory;
  const inventory = await buildInventory(await readFile(lockfilePath, "utf8"));
  await writeFile(output, `${JSON.stringify(inventory, null, 2)}\n`);
  console.log(
    `Wrote ${inventory.results[0].packages.length} packages to ${output}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
