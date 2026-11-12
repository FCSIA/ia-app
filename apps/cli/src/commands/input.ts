import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { usageError } from "../core/errors";
import type { CommandContext } from "../registry/types";

/** Reads a repeatable string option however the parser stored it. */
export function appendOption(context: CommandContext, name: string) {
  const value = context.options[name];
  return Array.isArray(value) ? value : value === undefined ? [] : [String(value)];
}

/** Reads a file argument, with `-` meaning standard input. */
export async function readFileOrStdin(context: CommandContext, path: string) {
  if (path === "-") return context.runtime.readStdin();
  try {
    return await readFile(resolve(context.runtime.cwd, path), "utf8");
  } catch {
    throw usageError("file_not_found", `Can't read ${path}.`, {
      next: [{ benefit: "Check the path", argv: [...context.path, "--help"] }],
    });
  }
}
