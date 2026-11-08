#!/usr/bin/env bun
import { runCli } from "./app";
import { processRuntime } from "./core/runtime";

// A closed stdout (`| head`) ends the command quietly.
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EPIPE") process.exit(0);
  throw error;
});

// One root signal handler: abort pending work, then exit with 128 + n.
const controller = new AbortController();
for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143], ["SIGHUP", 129]] as const) {
  process.on(signal, () => {
    controller.abort();
    process.exit(code);
  });
}

process.exitCode = await runCli(processRuntime(controller.signal));
