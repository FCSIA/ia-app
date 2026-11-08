import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CliError } from "./errors";
import type { Runtime } from "./runtime";

export interface AliasSetting {
  name: string;
  // Where the alias link lives.
  path: string;
  // The command the alias runs.
  target: string;
}

export interface CliConfig {
  alias?: AliasSetting;
  [key: string]: unknown;
}

const CONFIG_FILE = "config.json";

// Settings precedence: option, then environment, then the default location.
export function configDirectory(runtime: Runtime, option: string | undefined) {
  if (option) return option;
  const { env } = runtime;
  if (env.FCSIA_CONFIG_DIR) return env.FCSIA_CONFIG_DIR;
  if (env.XDG_CONFIG_HOME) return join(env.XDG_CONFIG_HOME, "fcsia");
  if (runtime.platform === "win32" && env.APPDATA) return join(env.APPDATA, "fcsia");
  return join(runtime.homedir, ".config", "fcsia");
}

export function configPath(directory: string) {
  return join(directory, CONFIG_FILE);
}

// Broken config is an error naming the file, never treated as absent or reset.
export function readConfig(directory: string): CliConfig {
  const path = configPath(directory);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new CliError("config", "invalid_config", `${path}: can't be read.`, {
      data: { path, cause: (error as Error).message },
    });
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as CliConfig;
  } catch {
    // Reported below with the file name.
  }
  throw new CliError("config", "invalid_config", `${path}: isn't a JSON object.`, {
    data: { path },
  });
}

// Read-modify-write that keeps unrelated keys and replaces the file atomically.
export function updateConfig(directory: string, change: (config: CliConfig) => CliConfig) {
  const current = readConfig(directory);
  const next = change({ ...current });
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = configPath(directory);
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
  return next;
}
