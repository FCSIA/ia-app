import { describe, expect, test } from "bun:test";
import { fakeRuntime } from "../testing";
import { resolveModes } from "./modes";

function modes(
  options: Parameters<typeof fakeRuntime>[0],
  flags: Parameters<typeof resolveModes>[1] = {},
) {
  return resolveModes(fakeRuntime(options).runtime, flags);
}

const TERMINAL = { stdoutTTY: true, stderrTTY: true, stdinTTY: true };

describe("interaction", () => {
  test("is interactive only at a real terminal", () => {
    expect(modes(TERMINAL).interactive).toBe(true);
    expect(modes({ ...TERMINAL, stdinTTY: false }).interactive).toBe(false);
    expect(modes({ ...TERMINAL, stderrTTY: false }).interactive).toBe(false);
  });

  test("piping stdout never turns off prompts or selects JSON", () => {
    const resolved = modes({ ...TERMINAL, stdoutTTY: false });
    expect(resolved.interactive).toBe(true);
    expect(resolved.format).toBe("human");
    expect(resolved.stdout.color).toBe(false);
  });

  test("--json, CI, --non-interactive, and agents turn off prompts", () => {
    expect(modes(TERMINAL, { json: true }).interactive).toBe(false);
    expect(modes({ ...TERMINAL, env: { CI: "true" } }).interactive).toBe(false);
    expect(modes(TERMINAL, { nonInteractive: true }).interactive).toBe(false);
    expect(modes({ ...TERMINAL, env: { CLAUDECODE: "1" } }).interactive).toBe(false);
  });

  test("CI=false and CI=0 are not CI", () => {
    expect(modes({ ...TERMINAL, env: { CI: "false" } }).ci).toBe(false);
    expect(modes({ ...TERMINAL, env: { CI: "0" } }).ci).toBe(false);
  });

  test("--non-interactive=false restores prompts for an agent at a terminal only", () => {
    const agent = { ...TERMINAL, env: { CLAUDECODE: "1" } };
    expect(modes(agent, { nonInteractive: false }).interactive).toBe(true);
    expect(modes(agent, { nonInteractive: false, json: true }).interactive).toBe(false);
    expect(modes({ ...agent, env: { CLAUDECODE: "1", CI: "1" } }, { nonInteractive: false }).interactive).toBe(false);
    expect(modes({ ...agent, stdinTTY: false }, { nonInteractive: false }).interactive).toBe(false);
  });

  test("agents still get human output unless they ask for JSON", () => {
    const resolved = modes({ env: { AI_AGENT: "my-agent" } });
    expect(resolved.agent).toBe("my-agent");
    expect(resolved.format).toBe("human");
  });

  test("--yes grants consent without changing interaction or format", () => {
    const resolved = modes(TERMINAL, { yes: true });
    expect(resolved.consent).toBe(true);
    expect(resolved.interactive).toBe(true);
    expect(resolved.format).toBe("human");
  });
});

describe("color precedence", () => {
  test("--no-color beats FORCE_COLOR", () => {
    expect(modes({ ...TERMINAL, env: { FORCE_COLOR: "1" } }, { color: false }).stderr.color).toBe(false);
  });

  test("NO_COLOR beats FORCE_COLOR", () => {
    expect(modes({ ...TERMINAL, env: { NO_COLOR: "1", FORCE_COLOR: "1" } }).stderr.color).toBe(false);
  });

  test("FORCE_COLOR colors pipes, FORCE_COLOR=0 turns color off", () => {
    expect(modes({ env: { FORCE_COLOR: "1" } }).stdout.color).toBe(true);
    expect(modes({ env: { FORCE_COLOR: "1" } }).stdout.detectedColor).toBe(false);
    expect(modes({ ...TERMINAL, env: { FORCE_COLOR: "0" } }).stdout.color).toBe(false);
  });

  test("TERM=dumb turns off color and rich layout", () => {
    const resolved = modes({ ...TERMINAL, env: { TERM: "dumb" } });
    expect(resolved.stderr.color).toBe(false);
    expect(resolved.stderr.rich).toBe(false);
  });

  test("accessible mode keeps color but drops rich layout", () => {
    const resolved = modes({ ...TERMINAL, env: { FCSIA_ACCESSIBLE: "1" } });
    expect(resolved.accessible).toBe(true);
    expect(resolved.stderr.rich).toBe(false);
    expect(resolved.stderr.color).toBe(true);
  });

  test("width defaults to 80 when unknown", () => {
    expect(modes({}).stdout.width).toBe(80);
    expect(modes({ ...TERMINAL, columns: 120 }).stdout.width).toBe(120);
  });
});
