import { accessSync, constants, lstatSync, readFileSync, readlinkSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import type { AliasSetting } from "./config";
import { CliError } from "./errors";
import type { Runtime } from "./runtime";

export const ALIAS_NAME_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

// Shell words an alias must never shadow.
const RESERVED_NAMES = new Set([
  "alias", "bg", "cd", "command", "echo", "eval", "exec", "exit", "export",
  "false", "fg", "jobs", "kill", "pwd", "read", "set", "source", "test",
  "true", "type", "unalias", "unset", "wait",
]);

export function aliasNameProblem(name: string, commandName: string) {
  if (!ALIAS_NAME_PATTERN.test(name)) {
    return "Alias names start with a lowercase letter and use lowercase letters, numbers, and hyphens.";
  }
  if (name === commandName || name === "fcsia") return `${name} is already the command's name.`;
  if (RESERVED_NAMES.has(name)) return `${name} is a shell command.`;
  return null;
}

function linkPath(directory: string, name: string, platform: NodeJS.Platform) {
  return join(directory, platform === "win32" ? `${name}.cmd` : name);
}

function exists(path: string) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function isExecutable(path: string, platform: NodeJS.Platform) {
  try {
    if (!lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink()) return false;
    if (platform !== "win32") accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function pathDirectories(runtime: Runtime) {
  return (runtime.env.PATH ?? runtime.env.Path ?? "")
    .split(delimiter)
    .filter((directory) => directory && isAbsolute(directory));
}

export function findOnPath(name: string, runtime: Runtime, exclude?: string) {
  const extensions =
    runtime.platform === "win32"
      ? (runtime.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";").map((extension) => extension.toLowerCase())
      : [""];
  for (const directory of pathDirectories(runtime)) {
    for (const extension of extensions) {
      const candidate = join(directory, `${name}${extension}`);
      if (candidate === exclude) continue;
      if (isExecutable(candidate, runtime.platform)) return candidate;
    }
  }
  return null;
}

// The installed command people run, which an alias should point at.
export function resolveInstalledCommand(runtime: Runtime, current: AliasSetting | undefined) {
  if (!runtime.compiled && !runtime.env.FCSIA_ARGV0) {
    throw new CliError(
      "conflict",
      "alias_unavailable",
      "Can't set an alias. This copy runs from source; install the CLI first.",
    );
  }
  const invoked = runtime.argv0;
  const located = /[\\/]/.test(invoked)
    ? resolve(runtime.cwd, invoked)
    : findOnPath(invoked, runtime) ?? runtime.execPath;
  // Running through the current alias resolves to the command it points at.
  if (current && resolve(located) === resolve(current.path)) return current.target;
  return located;
}

export function isAliasLink(path: string, target: string, platform: NodeJS.Platform) {
  try {
    if (platform === "win32") return readFileSync(path, "utf8").includes(`"${target}"`);
    if (!lstatSync(path).isSymbolicLink()) return false;
    return resolve(dirname(path), readlinkSync(path)) === resolve(target);
  } catch {
    return false;
  }
}

function writeLink(path: string, target: string, platform: NodeJS.Platform) {
  if (platform === "win32") {
    writeFileSync(path, `@echo off\r\n"${target}" %*\r\n`);
  } else {
    symlinkSync(target, path);
  }
}

function permissionError(directory: string, name: string) {
  return new CliError("permission", "permission_denied", `Can't write to ${directory}.`, {
    data: { directory },
    next: [
      {
        benefit: "Put the alias in a directory you own that is on your PATH",
        argv: ["cli", "alias", "set", name, "--dir", "<DIR>"],
      },
    ],
  });
}

export interface AliasPlan {
  name: string;
  path: string;
  target: string;
  // Another program on PATH with the same name.
  shadowed: string | null;
  directoryOnPath: boolean;
  unchanged: boolean;
}

export function planAlias(
  runtime: Runtime,
  options: { name: string; directory?: string; force: boolean; current?: AliasSetting },
): AliasPlan {
  const target = resolveInstalledCommand(runtime, options.current);
  const directory = options.directory ? resolve(runtime.cwd, options.directory) : dirname(target);
  const path = linkPath(directory, options.name, runtime.platform);

  if (exists(path)) {
    if (isAliasLink(path, target, runtime.platform)) {
      return { name: options.name, path, target, shadowed: null, directoryOnPath: true, unchanged: true };
    }
    throw new CliError("conflict", "alias_conflict", `Can't set alias ${options.name}. ${path} already exists.`, {
      data: { path },
      next: [{ benefit: "Pick another name", argv: ["cli", "alias", "set", "<NAME>"] }],
    });
  }

  const shadowed = findOnPath(options.name, runtime, path);
  if (shadowed && !options.force) {
    throw new CliError(
      "conflict",
      "alias_conflict",
      `Can't set alias ${options.name}. ${shadowed} already provides ${options.name}.`,
      {
        data: { path: shadowed },
        next: [
          { benefit: "Pick another name", argv: ["cli", "alias", "set", "<NAME>"] },
          {
            benefit: `Add it anyway; whichever comes first on your PATH runs`,
            argv: ["cli", "alias", "set", options.name, "--force"],
          },
        ],
      },
    );
  }

  const directoryOnPath = pathDirectories(runtime).some(
    (entry) => resolve(entry) === resolve(directory),
  );
  return { name: options.name, path, target, shadowed, directoryOnPath, unchanged: false };
}

export function applyAlias(plan: AliasPlan, platform: NodeJS.Platform) {
  try {
    writeLink(plan.path, plan.target, platform);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
      throw permissionError(dirname(plan.path), plan.name);
    }
    throw error;
  }
}

// Removes the link only when it still points at this CLI.
export function removeAliasLink(setting: AliasSetting, platform: NodeJS.Platform) {
  if (!exists(setting.path)) return "missing" as const;
  if (!isAliasLink(setting.path, setting.target, platform)) return "foreign" as const;
  try {
    unlinkSync(setting.path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
      throw new CliError("permission", "permission_denied", `Can't write to ${dirname(setting.path)}.`, {
        data: { directory: dirname(setting.path) },
      });
    }
    throw error;
  }
  return "removed" as const;
}
