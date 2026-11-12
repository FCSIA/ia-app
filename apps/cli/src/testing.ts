import { runCli } from "./app";
import type { Runtime, SecretStore } from "./core/runtime";
import type { GroupSpec } from "./registry/types";

export interface FakeRuntimeOptions {
  argv?: string[];
  argv0?: string;
  env?: Record<string, string | undefined>;
  stdoutTTY?: boolean;
  stderrTTY?: boolean;
  stdinTTY?: boolean;
  columns?: number;
  compiled?: boolean;
  cwd?: string;
  homedir?: string;
  platform?: NodeJS.Platform;
  arch?: string;
  execPath?: string;
  // Answers requests; unmatched requests fail like an unreachable network.
  fetch?: (request: Request) => Response | Promise<Response>;
  // null simulates a system without a credential store.
  secrets?: Map<string, string> | null;
  openUrl?: (url: string) => boolean;
  // Answers terminal prompts; default is to decline.
  confirm?: (question: string) => boolean | Promise<boolean>;
  // What standard input holds, for `-` file arguments.
  stdin?: string;
}

export function memorySecrets(store: Map<string, string>): SecretStore {
  const key = ({ service, name }: { service: string; name: string }) => `${service}/${name}`;
  return {
    get: async (secret) => store.get(key(secret)) ?? null,
    set: async (secret) => void store.set(key(secret), secret.value),
    delete: async (secret) => store.delete(key(secret)),
  };
}

export function fakeRuntime(options: FakeRuntimeOptions = {}) {
  let stdout = "";
  let stderr = "";
  const requests: Request[] = [];
  const opened: string[] = [];
  const asked: string[] = [];
  const secrets = options.secrets === undefined ? new Map<string, string>() : options.secrets;
  const runtime: Runtime = {
    argv: options.argv ?? [],
    argv0: options.argv0 ?? "fcsia",
    env: { PATH: "", ...options.env },
    stdout: {
      isTTY: options.stdoutTTY ?? false,
      columns: options.columns,
      write: (chunk) => (stdout += chunk),
    },
    stderr: {
      isTTY: options.stderrTTY ?? false,
      columns: options.columns,
      write: (chunk) => (stderr += chunk),
    },
    stdinIsTTY: options.stdinTTY ?? options.stderrTTY ?? false,
    cwd: options.cwd ?? "/",
    homedir: options.homedir ?? "/home/test",
    platform: options.platform ?? "darwin",
    arch: options.arch ?? "arm64",
    execPath: options.execPath ?? "/usr/local/bin/fcsia",
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request.clone());
      if (!options.fetch) throw new TypeError("fetch failed");
      return options.fetch(request);
    }) as typeof fetch,
    sleep: async () => {},
    confirm: async (question) => {
      asked.push(question);
      return options.confirm?.(question) ?? false;
    },
    readStdin: async () => options.stdin ?? "",
    signal: new AbortController().signal,
    secrets: secrets ? memorySecrets(secrets) : null,
    openUrl: async (url) => {
      opened.push(url);
      return options.openUrl?.(url) ?? true;
    },
    compiled: options.compiled ?? false,
  };
  return {
    runtime,
    stdout: () => stdout,
    stderr: () => stderr,
    requests,
    opened,
    asked,
    secrets,
  };
}

export async function run(argv: string[], options: FakeRuntimeOptions = {}, root?: GroupSpec) {
  const fake = fakeRuntime({ ...options, argv });
  const code = await runCli(fake.runtime, root);
  return {
    code,
    stdout: fake.stdout(),
    stderr: fake.stderr(),
    runtime: fake.runtime,
    requests: fake.requests,
    opened: fake.opened,
    asked: fake.asked,
    secrets: fake.secrets,
  };
}
