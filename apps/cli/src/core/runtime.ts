import { homedir } from "node:os";
import { basename } from "node:path";

export const DEFAULT_COMMAND_NAME = "fcsia";

export interface OutStream {
  isTTY: boolean;
  columns?: number;
  write(chunk: string): unknown;
}

// Everything a command may read from the process, injected so tests can run
// every mode (TTY, piped, CI, agent) without touching the real terminal.
export interface Runtime {
  argv: string[];
  argv0: string;
  env: Record<string, string | undefined>;
  stdout: OutStream;
  stderr: OutStream;
  stdinIsTTY: boolean;
  cwd: string;
  homedir: string;
  platform: NodeJS.Platform;
  execPath: string;
  // True when running as a `bun build --compile` executable rather than from
  // source through `bun src/main.ts`.
  compiled: boolean;
}

declare const __FCSIA_CLI_VERSION__: string | undefined;

export function cliVersion() {
  return typeof __FCSIA_CLI_VERSION__ === "string"
    ? __FCSIA_CLI_VERSION__
    : "0.0.0-dev";
}

function isCompiledEntry(entry: string | undefined) {
  return Boolean(entry && (entry.startsWith("/$bunfs/") || entry.includes("~BUN")));
}

export function processRuntime(): Runtime {
  return {
    argv: process.argv.slice(2),
    argv0: process.env.FCSIA_ARGV0 || process.argv0,
    env: process.env,
    stdout: process.stdout,
    stderr: process.stderr,
    stdinIsTTY: Boolean(process.stdin.isTTY),
    cwd: process.cwd(),
    homedir: homedir(),
    platform: process.platform,
    execPath: process.execPath,
    compiled: isCompiledEntry(process.argv[1]),
  };
}

// The name people typed, so help and suggestions repeat it. Someone who added
// an `ia` alias sees `ia` in every command the CLI prints.
export function invokedCommandName(runtime: Pick<Runtime, "argv0" | "compiled" | "env">) {
  if (!runtime.compiled && !runtime.env.FCSIA_ARGV0) return DEFAULT_COMMAND_NAME;
  const name = basename(runtime.argv0).replace(/\.(exe|cmd)$/i, "");
  return /^[a-z][a-z0-9-]{0,31}$/.test(name) ? name : DEFAULT_COMMAND_NAME;
}
