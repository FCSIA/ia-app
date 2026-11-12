#!/usr/bin/env node
/**
 * Turn the compiled CLI binaries into npm packages.
 *
 *   node scripts/package-cli-npm.mjs --binaries dist/cli --out dist/npm --version 0.5.0
 *
 * The main package is a small Node shim; each platform package holds one
 * binary and is selected by npm's `os` and `cpu` fields through
 * optionalDependencies.
 */
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    binaries: { type: "string" },
    out: { type: "string" },
    version: { type: "string" },
  },
});

if (!values.binaries || !values.out || !values.version) {
  console.error("Usage: node scripts/package-cli-npm.mjs --binaries DIR --out DIR --version VERSION");
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(values.version)) {
  console.error(`Not a release version: ${values.version}`);
  process.exit(1);
}

const platforms = [
  { id: "darwin-arm64", asset: "fcsia-darwin-arm64", file: "fcsia", os: ["darwin"], cpu: ["arm64"], label: "macOS on Apple Silicon" },
  { id: "darwin-x64", asset: "fcsia-darwin-x64", file: "fcsia", os: ["darwin"], cpu: ["x64"], label: "macOS on Intel" },
  { id: "linux-x64", asset: "fcsia-linux-x64", file: "fcsia", os: ["linux"], cpu: ["x64"], label: "Linux on x64" },
  { id: "linux-arm64", asset: "fcsia-linux-arm64", file: "fcsia", os: ["linux"], cpu: ["arm64"], label: "Linux on arm64" },
  { id: "win32-x64", asset: "fcsia-windows-x64.exe", file: "fcsia.exe", os: ["win32"], cpu: ["x64"], label: "Windows on x64" },
];

const version = values.version;
const binaries = values.binaries;
const out = values.out;

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "platforms"), { recursive: true });

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const optionalDependencies = {};
for (const platform of platforms) {
  const source = join(binaries, platform.asset);
  if (!existsSync(source) || statSync(source).size === 0) {
    console.error(`Missing release binary: ${source}`);
    process.exit(1);
  }
  const name = `@fcsia/cli-${platform.id}`;
  const directory = join(out, "platforms", `cli-${platform.id}`);
  mkdirSync(join(directory, "bin"), { recursive: true });
  copyFileSync(source, join(directory, "bin", platform.file));
  chmodSync(join(directory, "bin", platform.file), 0o755);
  writeJson(join(directory, "package.json"), {
    name,
    version,
    description: `fcsia binary for ${platform.label}`,
    os: platform.os,
    cpu: platform.cpu,
    files: ["bin"],
  });
  optionalDependencies[name] = version;
}

const cli = join(out, "cli");
mkdirSync(join(cli, "bin"), { recursive: true });

writeJson(join(cli, "package.json"), {
  name: "@fcsia/cli",
  version,
  description: "Command-line client for IA App",
  bin: { fcsia: "bin/fcsia.js" },
  files: ["bin", "README.md"],
  engines: { node: ">=18" },
  optionalDependencies,
  repository: {
    type: "git",
    url: "git+https://github.com/FCSIA/ia-app.git",
    directory: "apps/cli",
  },
  homepage: "https://app.fcsia.com",
  bugs: { url: "https://github.com/FCSIA/ia-app/issues" },
  keywords: ["ia-app", "cli", "school"],
});

writeFileSync(
  join(cli, "bin", "fcsia.js"),
  `#!/usr/bin/env node
const { spawn } = require("node:child_process");
const { chmodSync } = require("node:fs");

const suffix = process.platform === "win32" ? ".exe" : "";
const name = \`@fcsia/cli-\${process.platform}-\${process.arch}\`;
let binary;
try {
  binary = require.resolve(\`\${name}/bin/fcsia\${suffix}\`);
} catch {
  console.error(\`fcsia: no build for \${process.platform}-\${process.arch}.\`);
  console.error("Download a release from https://github.com/FCSIA/ia-app/releases.");
  process.exit(1);
}
try {
  chmodSync(binary, 0o755);
} catch {
  // A read-only install is fine when the mode bits already allow execution.
}
const child = spawn(binary, process.argv.slice(2), { stdio: "inherit" });
child.on("error", (error) => {
  console.error(\`fcsia: \${error.message}\`);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
`,
  { mode: 0o755 },
);

writeFileSync(
  join(cli, "README.md"),
  `# fcsia

Command-line client for IA App.

    npm install -g @fcsia/cli
    fcsia login

Documentation: https://github.com/FCSIA/ia-app/blob/main/docs/reference/cli.md
`,
);

const order = platforms.map((platform) => join("platforms", `cli-${platform.id}`));
writeFileSync(join(out, "publish-order.txt"), [...order, "cli"].join("\n"));

const bytes = platforms.reduce((total, platform) => total + statSync(join(binaries, platform.asset)).size, 0);
console.log(`Packaged @fcsia/cli ${version} for ${platforms.length} platforms (${Math.round(bytes / 1024 / 1024)} MB of binaries).`);
console.log(readFileSync(join(out, "publish-order.txt"), "utf8"));
