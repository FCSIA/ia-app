import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const registryUrl = "https://www.fluidfunctionalism.com/r/registry.json";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const webDir = join(root, "apps", "web");
const write = process.argv.includes("--write");

if (process.argv.includes("--help")) {
  console.log(`Usage: pnpm fluid:update [-- --write]

Refresh every Radix Fluid Functionalism UI component.

By default the command runs shadcn in dry-run mode. Pass --write to overwrite
the local Fluid component files and their registry dependencies.`);
  process.exit(0);
}

const response = await fetch(registryUrl);
if (!response.ok) {
  throw new Error(
    `Could not load the Fluid registry (${response.status} ${response.statusText}).`,
  );
}

const registry = await response.json();
const componentNames = registry.items
  .filter((item) => item.type === "registry:ui" && !item.name.endsWith("-base"))
  .map((item) => `@fluid/${item.name}`);

if (componentNames.length === 0) {
  throw new Error("The Fluid registry did not return any Radix UI components.");
}

console.log(
  `${write ? "Updating" : "Previewing updates for"} ${componentNames.length} Fluid components.`,
);

const args = [
  "dlx",
  "shadcn@latest",
  "add",
  ...componentNames,
  "--overwrite",
  "-c",
  webDir,
  ...(write ? ["--yes"] : ["--dry-run"]),
];

const result = spawnSync("pnpm", args, {
  cwd: root,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
