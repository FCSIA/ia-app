import { describe, expect, test } from "bun:test";
import { fakeRuntime } from "../testing";
import { CliError } from "./errors";
import { resolveModes } from "./modes";
import { Output } from "./output";
import { formatCommand, quoteArgument } from "./shell";
import { sanitizeRemoteText } from "./theme";

function output(options: Parameters<typeof fakeRuntime>[0] = {}, json = false) {
  const fake = fakeRuntime(options);
  const out = new Output(fake.runtime, resolveModes(fake.runtime, { json }), "fcsia");
  return { out, ...fake };
}

describe("transcript", () => {
  test("rich rows use the gutter and a 16-column label", () => {
    const { out, stderr } = output({ stderrTTY: true, env: { NO_COLOR: "1" } });
    out.success("Added", "ia");
    out.row("Path", "/usr/local/bin/ia");
    expect(stderr()).toBe("✓ Added           ia\n  Path            /usr/local/bin/ia\n");
  });

  test("plain rows start at column 0 and glyphs become words", () => {
    const { out, stderr } = output();
    out.success("Added", "ia");
    out.warn({ reason: "example", message: "Check this." });
    expect(stderr()).toBe("Added ia\nWarning: Check this.\n");
  });

  test("a value that doesn't fit moves below its label", () => {
    const { out, stderr } = output({ stderrTTY: true, columns: 40, env: { NO_COLOR: "1" } });
    out.row("Path", "/a/very/long/path/that/does/not/fit/here");
    expect(stderr()).toBe("  Path\n    /a/very/long/path/that/does/not/fit/here\n");
  });

  test("blank lines separate phases without doubling", () => {
    const { out, stderr } = output();
    out.blank();
    out.text("one");
    out.blank();
    out.blank();
    out.text("two");
    expect(stderr()).toBe("one\n\ntwo\n");
  });

  test("--json silences the transcript and collects warnings into the document", () => {
    const { out, stdout, stderr } = output({}, true);
    out.text("context");
    out.warn({ reason: "example", message: "Check this." });
    out.document({ thing: { id: "1" } });
    expect(stderr()).toBe("");
    expect(JSON.parse(stdout())).toEqual({
      thing: { id: "1" },
      warnings: [{ reason: "example", message: "Check this." }],
    });
  });

  test("JSON is compact when piped and indented at a terminal", () => {
    const piped = output({}, true);
    piped.out.document({ a: 1 });
    expect(piped.stdout()).toBe('{"a":1}\n');
    const terminal = output({ stdoutTTY: true }, true);
    terminal.out.document({ a: 1 });
    expect(terminal.stdout()).toBe('{\n  "a": 1\n}\n');
  });

  test("the bare identifier prints only when piped or non-interactive", () => {
    const piped = output({ stderrTTY: true, stdinTTY: true });
    piped.out.identifier("abc");
    expect(piped.stdout()).toBe("abc\n");
    const terminal = output({ stdoutTTY: true, stderrTTY: true, stdinTTY: true });
    terminal.out.identifier("abc");
    expect(terminal.stdout()).toBe("");
  });
});

describe("errors", () => {
  test("missing input is action_required and exits 2", () => {
    const error = new CliError("missing_input", "missing_scope", "Can't do it without a team.");
    expect(error.status).toBe("action_required");
    expect(error.exitCode).toBe(2);
    expect(new CliError("canceled", "canceled", "Canceled.").exitCode).toBe(130);
  });

  test("the JSON error document omits fields that don't apply", () => {
    const { out, stderr } = output({}, true);
    out.error(new CliError("not_found", "not_found", "Couldn't find it."));
    expect(JSON.parse(stderr())).toEqual({
      status: "error",
      reason: "not_found",
      message: "Couldn't find it.",
    });
  });
});

describe("shell quoting and remote text", () => {
  test("quotes only what the shell would misread", () => {
    expect(quoteArgument("ia")).toBe("ia");
    expect(quoteArgument("<NAME>")).toBe("<NAME>");
    expect(quoteArgument("two words")).toBe("'two words'");
    expect(quoteArgument("it's")).toBe(`'it'"'"'s'`);
    expect(quoteArgument("<script>")).toBe("'<script>'");
    expect(formatCommand("fcsia", ["cli", "alias", "set", "ia"])).toBe("fcsia cli alias set ia");
  });

  test("strips terminal control sequences from remote text", () => {
    expect(sanitizeRemoteText("hi\u001b[2J\u001b[31mred\u001b[0m\u0007")).toBe("hired");
    expect(sanitizeRemoteText("link \u001b]8;;https://x\u0007text\u001b]8;;\u0007")).toBe("link text");
    expect(sanitizeRemoteText("tab\tand\nnewline")).toBe("tab\tand\nnewline");
  });
});
