import { runCli } from "./app";
import type { Runtime } from "./core/runtime";
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
}

export function fakeRuntime(options: FakeRuntimeOptions = {}) {
  let stdout = "";
  let stderr = "";
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
    platform: "darwin",
    execPath: "/usr/local/bin/fcsia",
    compiled: options.compiled ?? false,
  };
  return {
    runtime,
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

export async function run(argv: string[], options: FakeRuntimeOptions = {}, root?: GroupSpec) {
  const fake = fakeRuntime({ ...options, argv });
  const code = await runCli(fake.runtime, root);
  return { code, stdout: fake.stdout(), stderr: fake.stderr(), runtime: fake.runtime };
}
