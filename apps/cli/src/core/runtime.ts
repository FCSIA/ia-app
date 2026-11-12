import { spawn } from "node:child_process";
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
  arch: string;
  execPath: string;
  fetch: typeof fetch;
  // Resolves early, without throwing, when the signal aborts.
  sleep(milliseconds: number, signal?: AbortSignal): Promise<void>;
  // Asks one yes/no question on the terminal. Only called when interactive.
  confirm(question: string): Promise<boolean>;
  // Reads all of standard input, for `-` file arguments.
  readStdin(): Promise<string>;
  // Aborts on Ctrl-C so long waits, such as sign-in polling, stop promptly.
  signal: AbortSignal;
  // The operating system's credential store, or null where it's unavailable.
  secrets: SecretStore | null;
  // Opens a URL in the default browser. Resolves false when it can't.
  openUrl(url: string): Promise<boolean>;
  // True when running as a `bun build --compile` executable rather than from
  // source through `bun src/main.ts`.
  compiled: boolean;
}

export interface SecretKey {
  service: string;
  name: string;
}

export interface SecretStore {
  get(key: SecretKey): Promise<string | null>;
  set(key: SecretKey & { value: string }): Promise<void>;
  delete(key: SecretKey): Promise<boolean>;
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

function sleep(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, milliseconds);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

function openUrl(url: string) {
  const [command, ...args] =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url.replace(/&/g, "^&")]
        : ["xdg-open", url];
  return new Promise<boolean>((resolve) => {
    try {
      const child = spawn(command!, args, { stdio: "ignore", detached: true });
      child.once("error", () => resolve(false));
      child.once("spawn", () => {
        child.unref();
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });
}

async function readStdin() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function ask(question: string) {
  const { createInterface } = await import("node:readline/promises");
  const terminal = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await terminal.question(`${question} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    terminal.close();
  }
}

function systemSecrets(): SecretStore | null {
  const secrets = (globalThis as { Bun?: { secrets?: SecretStore } }).Bun?.secrets;
  if (!secrets) return null;
  return {
    get: (key) => secrets.get(key),
    set: async (key) => {
      await secrets.set(key);
    },
    delete: (key) => secrets.delete(key),
  };
}

export function processRuntime(signal: AbortSignal = new AbortController().signal): Runtime {
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
    arch: process.arch,
    execPath: process.execPath,
    fetch: globalThis.fetch.bind(globalThis),
    sleep,
    confirm: ask,
    readStdin,
    signal,
    // FCSIA_CREDENTIAL_STORE=file skips the system store, for containers and
    // CI where a keyring prompt would hang.
    secrets: process.env.FCSIA_CREDENTIAL_STORE === "file" ? null : systemSecrets(),
    openUrl,
    compiled: isCompiledEntry(process.argv[1]),
  };
}

// Sent on every request. The server shows the version and platform when it
// lists CLI sign-ins, so people can recognize their own devices.
export function userAgent(runtime: Pick<Runtime, "platform" | "arch">) {
  return `fcsia/${cliVersion()} (${runtime.platform}; ${runtime.arch})`;
}

// The name people typed, so help and suggestions repeat it. Someone who added
// an `ia` alias sees `ia` in every command the CLI prints.
export function invokedCommandName(runtime: Pick<Runtime, "argv0" | "compiled" | "env">) {
  if (!runtime.compiled && !runtime.env.FCSIA_ARGV0) return DEFAULT_COMMAND_NAME;
  const name = basename(runtime.argv0).replace(/\.(exe|cmd)$/i, "");
  return /^[a-z][a-z0-9-]{0,31}$/.test(name) ? name : DEFAULT_COMMAND_NAME;
}
