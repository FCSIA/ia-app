import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const registryUrl = "https://www.fluidfunctionalism.com/r/registry.json";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const webDir = join(root, "apps", "web");
const cliArgs = process.argv.slice(2).filter((arg) => arg !== "--");
const write = cliArgs.includes("--write");
const forceAdapted = cliArgs.includes("--force-adapted");
const requestedNames = cliArgs
  .filter((arg) => !arg.startsWith("--"))
  .map((name) => name.replace(/^@fluid\//, ""));

// These components deliberately preserve app-specific public APIs or rendered
// DOM contracts. Updating them requires a reviewed merge, not replacement.
const adaptedComponents = new Set([
  "accordion",
  "badge",
  "button",
  "card",
  "checkbox-group",
  "color-picker",
  "dialog",
  "dropdown",
  "input-copy",
  "radio-group",
  "scroll-area",
  "slider",
  "switch",
  "table",
  "tabs-subtle",
  "thinking-indicator",
  "thinking-steps",
  "tooltip",
]);

if (process.argv.includes("--help")) {
  console.log(`Usage:
  bun run fluid:update [component...]
  bun run fluid:update -- --write component...

Preview current Radix Fluid Functionalism registry changes. With no component
names, every component is previewed.

Writing requires an explicit component list. App-adapted primitives are
protected; merge those manually after reviewing the diff, or intentionally
bypass the guard with --force-adapted.`);
  process.exit(0);
}

const response = await fetch(registryUrl);
if (!response.ok) {
  throw new Error(
    `Could not load the Fluid registry (${response.status} ${response.statusText}).`,
  );
}

const registry = await response.json();
const availableNames = registry.items
  .filter((item) => item.type === "registry:ui" && !item.name.endsWith("-base"))
  .map((item) => item.name);

const unknownNames = requestedNames.filter(
  (name) => !availableNames.includes(name),
);
if (unknownNames.length > 0) {
  throw new Error(`Unknown Fluid component(s): ${unknownNames.join(", ")}`);
}

if (write && requestedNames.length === 0) {
  throw new Error(
    "Refusing to overwrite every primitive. Pass the component names to update.",
  );
}

const selectedNames =
  requestedNames.length > 0 ? requestedNames : availableNames;
const protectedNames = selectedNames.filter((name) =>
  adaptedComponents.has(name),
);
if (write && protectedNames.length > 0 && !forceAdapted) {
  throw new Error(
    `Refusing to overwrite app-adapted primitive(s): ${protectedNames.join(", ")}. Review and merge their registry diffs manually.`,
  );
}

const componentNames = selectedNames.map((name) => `@fluid/${name}`);

if (componentNames.length === 0) {
  throw new Error("The Fluid registry did not return any Radix UI components.");
}

console.log(
  `${write ? "Updating" : "Previewing updates for"} ${componentNames.length} Fluid components.`,
);
if (!write && protectedNames.length > 0) {
  console.log(`App-adapted (review-only): ${protectedNames.join(", ")}.`);
}

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

const result = spawnSync("bun", args, {
  cwd: root,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
