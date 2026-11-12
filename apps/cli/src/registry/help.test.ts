import { describe, expect, test } from "bun:test";
import { createRootCommand } from "../commands";
import { visibleLength } from "../core/theme";
import { run } from "../testing";
import { listCommands } from "./help";
import { parseInvocation } from "./parse";
import type { Node } from "./types";

const root = createRootCommand();
const ANSI = /\u001b\[/;

function allNodes(node: Node, path: string[] = []): Array<{ node: Node; path: string[] }> {
  const here = path.length > 0 ? [{ node, path }] : [];
  if (node.kind === "command") return here;
  return [
    ...here,
    ...node.children.flatMap((child) => allNodes(child, [...path, child.name])),
    ...(node.defaultCommand ? [{ node: node.defaultCommand, path }] : []),
  ];
}

describe("help contract", () => {
  test("root help goes to stdout, exits 0, and fits 80 columns without color", async () => {
    const result = await run([]);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toMatch(ANSI);
    expect(result.stdout.startsWith("fcsia <command> [options]\n")).toBe(true);
    for (const line of result.stdout.split("\n")) expect(visibleLength(line)).toBeLessThanOrEqual(80);
  });

  test("every listed command's help fits 80 columns", async () => {
    for (const { path } of listCommands(root)) {
      const result = await run([...path, "--help"]);
      expect(result.code).toBe(0);
      for (const line of result.stdout.split("\n")) expect(visibleLength(line)).toBeLessThanOrEqual(80);
    }
  });

  test("help is styled for a color terminal but never when color is forced", async () => {
    expect((await run(["--help"], { stdoutTTY: true })).stdout).toMatch(ANSI);
    expect((await run(["--help"], { env: { FORCE_COLOR: "1" } })).stdout).not.toMatch(ANSI);
    expect((await run(["--help", "--no-color"], { stdoutTTY: true })).stdout).not.toMatch(ANSI);
  });

  test("help needs no settings, sign-in, or network", async () => {
    const result = await run(["cli", "alias", "set", "--help"], {
      env: { FCSIA_CONFIG_DIR: "/nonexistent/path" },
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("fcsia cli alias set <name> [options]");
  });

  test("help --json prints one document with the command contract", async () => {
    const result = await run(["cli", "alias", "set", "--help", "--json"]);
    const document = JSON.parse(result.stdout);
    expect(document.command).toMatchObject({
      path: "cli alias set",
      usage: "fcsia cli alias set <name> [options]",
      json: true,
      arguments: [{ name: "name", required: true, variadic: false }],
    });
    expect(document.command.options.map((option: { name: string }) => option.name)).toEqual([
      "json",
      "dir",
      "force",
    ]);
  });

  test("help <path> matches <path> --help", async () => {
    const viaCommand = await run(["help", "cli", "alias"]);
    const viaFlag = await run(["cli", "alias", "--help"]);
    expect(viaCommand.stdout).toBe(viaFlag.stdout);
  });

  test("the invoked name appears in help, so aliases teach themselves", async () => {
    const result = await run(["cli", "alias", "set", "--help"], { argv0: "/usr/local/bin/ia", compiled: true });
    expect(result.stdout).toContain("ia cli alias set <name> [options]");
    expect(result.stdout).toContain("    ia cli alias set ia\n");
  });
});

describe("registry metadata", () => {
  const nodes = allNodes(root);

  test("summaries are imperative fragments without a trailing period", () => {
    for (const { node } of nodes) {
      expect(node.summary.length).toBeGreaterThan(0);
      expect(node.summary.endsWith(".")).toBe(false);
      expect(node.summary[0]).toBe(node.summary[0]!.toUpperCase());
    }
  });

  test("every example parses through the real parser and uses long options", () => {
    for (const { node } of nodes) {
      if (node.kind !== "command") continue;
      for (const example of node.examples ?? []) {
        expect(() => parseInvocation(root, example.argv, "fcsia")).not.toThrow();
        for (const token of example.argv) expect(/^-[a-z]$/i.test(token)).toBe(false);
      }
    }
  });

  test("option names are lowercase kebab-case and selectors never end in -id", () => {
    for (const { node } of nodes) {
      if (node.kind !== "command") continue;
      for (const option of node.options ?? []) {
        expect(option.name).toMatch(/^[a-z][a-z0-9-]*$/);
        expect(option.name.endsWith("-id")).toBe(false);
      }
    }
  });
});

describe("help search", () => {
  test("finds commands offline", async () => {
    const result = await run(["help", "search", "alias", "--json"]);
    const document = JSON.parse(result.stdout);
    expect(document.commands.map((command: { path: string }) => command.path)).toContain("cli alias set");
  });

  test("no match exits 0 with a message on stderr only", async () => {
    const result = await run(["help", "search", "zzzz"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe('No commands match "zzzz".\n');
  });

  test("non-TTY tables keep the header and separate columns with tabs", async () => {
    const result = await run(["help", "search", "alias"]);
    const [header, first] = result.stdout.split("\n");
    expect(header).toBe("Command\tSummary");
    expect(first?.split("\t")).toHaveLength(2);
  });
});

describe("version", () => {
  test("prints only the version, or { version } with --json", async () => {
    expect((await run(["--version"])).stdout).toBe("0.0.0-dev\n");
    expect(JSON.parse((await run(["--version", "--json"])).stdout)).toEqual({ version: "0.0.0-dev" });
    expect((await run(["cli", "--version"])).stdout).toBe("0.0.0-dev\n");
  });
});
