import { describe, expect, test } from "bun:test";
import { createRootCommand } from "../commands";
import { CliError } from "../core/errors";
import { run } from "../testing";
import { parseInvocation } from "./parse";
import type { GroupSpec } from "./types";

const calls: Array<{ args: string[]; options: Record<string, unknown> }> = [];

function fixtureRoot(): GroupSpec {
  return {
    kind: "group",
    name: "",
    summary: "Fixture",
    children: [
      {
        kind: "group",
        name: "things",
        summary: "Work with things",
        aliases: ["thing"],
        children: [
          {
            kind: "command",
            name: "add",
            summary: "Add a thing",
            arguments: [{ name: "name", required: true, description: "Name" }],
            options: [
              { name: "label", type: "string", description: "Label", repeat: "append" },
              { name: "color", type: "boolean", description: "Colorful" },
              { name: "size", type: "string", description: "Size", repeat: "last" },
              { name: "note", type: "string", description: "Note" },
            ],
            json: true,
            run(context) {
              calls.push({ args: context.args, options: context.options });
            },
          },
        ],
      },
    ],
  };
}

function parse(argv: string[]) {
  return parseInvocation(fixtureRoot(), argv, "fcsia");
}

function parseError(argv: string[]) {
  try {
    parse(argv);
  } catch (error) {
    if (error instanceof CliError) return error;
    throw error;
  }
  throw new Error("expected a usage error");
}

describe("routing", () => {
  test("walks groups to the leaf and keeps option values", () => {
    const invocation = parse(["things", "add", "lamp", "--label", "a", "--label=b"]);
    expect(invocation.mode).toBe("run");
    expect(invocation.path).toEqual(["things", "add"]);
    expect(invocation.args).toEqual(["lamp"]);
    expect(invocation.options.label).toEqual(["a", "b"]);
  });

  test("accepts global options before the command, including their values", () => {
    const invocation = parse(["--host", "http://localhost:3000", "things", "add", "lamp"]);
    expect(invocation.globals.host).toBe("http://localhost:3000");
    expect(invocation.path).toEqual(["things", "add"]);
  });

  test("routes through permanent aliases to the canonical path", () => {
    expect(parse(["thing", "add", "lamp"]).path).toEqual(["things", "add"]);
  });

  test("treats everything after -- as positional", () => {
    const invocation = parse(["things", "add", "--", "--label"]);
    expect(invocation.args).toEqual(["--label"]);
    expect(invocation.options.label).toBeUndefined();
  });

  test("shows group help when a group is invoked without an action", () => {
    expect(parse(["things"]).mode).toBe("help");
    expect(parse(["things", "--bogus"]).mode).toBe("help");
  });

  test("--help anywhere wins over everything else", () => {
    const invocation = parse(["things", "add", "--version", "--help", "--nope"]);
    expect(invocation.mode).toBe("help");
    expect(invocation.path).toEqual(["things", "add"]);
  });

  test("--version at any depth prints only the version", () => {
    expect(parse(["--version"]).mode).toBe("version");
    expect(parse(["things", "add", "lamp", "-v"]).mode).toBe("version");
  });
});

describe("strict leaf parsing", () => {
  test("rejects unknown commands with at most one suggestion", () => {
    const error = parseError(["thigns", "add"]);
    expect(error.reason).toBe("unknown_command");
    expect(error.exitCode).toBe(2);
    expect(error.options.next?.[0]?.argv).toEqual(["things"]);
  });

  test("never prefix-matches options", () => {
    const prefix = parseError(["things", "add", "lamp", "--lab", "x"]);
    expect(prefix.reason).toBe("unknown_option");
    expect(prefix.options.next).toEqual([{ benefit: "See the options", argv: ["things", "add", "--help"] }]);
    const typo = parseError(["things", "add", "lamp", "--labl", "x"]);
    expect(typo.options.next?.[0]?.argv).toEqual(["things", "add", "lamp", "--label", "x"]);
  });

  test("rejects repeated single-value options and keeps the last for last-wins", () => {
    expect(parseError(["things", "add", "lamp", "--note", "a", "--note", "b"]).reason).toBe("invalid_arguments");
    expect(parse(["things", "add", "lamp", "--size", "s", "--size", "l"]).options.size).toBe("l");
  });

  test("parses boolean negation and explicit true or false", () => {
    expect(parse(["things", "add", "lamp", "--no-color"]).options.color).toBe(false);
    expect(parse(["things", "add", "lamp", "--color=false"]).options.color).toBe(false);
    expect(parse(["things", "add", "lamp", "--color=true"]).options.color).toBe(true);
    expect(parseError(["things", "add", "lamp", "--color=maybe"]).reason).toBe("invalid_arguments");
  });

  test("rejects missing and extra positionals before any work", () => {
    expect(parseError(["things", "add"]).message).toBe("Missing <name> for fcsia things add.");
    expect(parseError(["things", "add", "a", "b"]).message).toBe("Unexpected argument b for fcsia things add.");
  });

  test("reads --non-interactive=false as an explicit false", () => {
    expect(parse(["things", "add", "lamp", "--non-interactive=false"]).globals.nonInteractive).toBe(false);
    expect(parse(["things", "add", "lamp"]).globals.nonInteractive).toBeUndefined();
  });

  test("rejects --json on commands that don't support it", () => {
    const root: GroupSpec = {
      kind: "group",
      name: "",
      summary: "Fixture",
      children: [{ kind: "command", name: "plain", summary: "Plain", run() {} }],
    };
    expect(() => parseInvocation(root, ["plain", "--json"], "fcsia")).toThrow(CliError);
  });
});

describe("running commands", () => {
  test("usage errors exit 2 and leave stdout empty", async () => {
    const result = await run(["nope"]);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Error: Unknown command nope for fcsia.");
  });

  test("with --json a failure writes one error document to stderr", async () => {
    const result = await run(["nope", "--json"]);
    expect(result.stdout).toBe("");
    const lines = result.stderr.trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({
      status: "error",
      reason: "unknown_command",
      message: "Unknown command nope for fcsia.",
      next: [{ command: "fcsia --help", argv: ["fcsia", "--help"] }],
    });
  });

  test("the fixture command runs with parsed values", async () => {
    calls.length = 0;
    const result = await run(["things", "add", "lamp", "--color"], {}, fixtureRoot());
    expect(result.code).toBe(0);
    expect(calls).toEqual([{ args: ["lamp"], options: { color: true } }]);
  });

  test("an unexpected exception is reported as a CLI bug with exit 1", async () => {
    const root: GroupSpec = {
      kind: "group",
      name: "",
      summary: "Fixture",
      children: [
        {
          kind: "command",
          name: "boom",
          summary: "Fail",
          run() {
            throw new Error("kaboom");
          },
        },
      ],
    };
    const result = await run(["boom"], {}, root);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Unexpected error in fcsia boom. This is a bug in the CLI.");
    expect(result.stderr).toContain("fcsia boom --debug");
  });

  test("the real root parses its own help examples", () => {
    expect(() => parseInvocation(createRootCommand(), ["help", "--all", "--json"], "fcsia")).not.toThrow();
  });
});
