import type { OutStream, Runtime } from "./runtime";

export interface Presentation {
  isTTY: boolean;
  // Animation, glyph gutters, and aligned layouts.
  rich: boolean;
  color: boolean;
  // Help stays unstyled unless color comes from terminal detection.
  detectedColor: boolean;
  width: number;
}

// Interaction, format, presentation, and consent resolve independently. Commands
// read these values and never inspect TTYs, CI, or agent variables themselves.
export interface Modes {
  interactive: boolean;
  format: "human" | "json";
  stdout: Presentation;
  stderr: Presentation;
  consent: boolean;
  ci: boolean;
  agent: string | null;
  accessible: boolean;
  guidance: boolean;
  debug: boolean;
}

export interface ModeOptions {
  json?: boolean;
  // undefined when not given; `--non-interactive=false` is an explicit false.
  nonInteractive?: boolean;
  // false for `--no-color`.
  color?: boolean;
  yes?: boolean;
  debug?: boolean;
}

const AGENT_VARIABLES: Array<[string, string]> = [
  ["AI_AGENT", "agent"],
  ["CLAUDECODE", "claude-code"],
  ["CURSOR_AGENT", "cursor"],
  ["GEMINI_CLI", "gemini-cli"],
  ["CODEX_SANDBOX", "codex"],
  ["OPENCODE", "opencode"],
];

export function isTruthyFlag(value: string | undefined) {
  if (value === undefined) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== "" && normalized !== "0" && normalized !== "false";
}

export function detectAgent(env: Runtime["env"]) {
  for (const [variable, name] of AGENT_VARIABLES) {
    const value = env[variable];
    if (isTruthyFlag(value)) return variable === "AI_AGENT" ? value!.trim() : name;
  }
  return null;
}

function colorPreference(env: Runtime["env"], option: boolean | undefined) {
  if (option === false) return false;
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== "") return false;
  const forced = env.FORCE_COLOR;
  if (forced !== undefined && forced !== "") return forced !== "0" && forced !== "false";
  return undefined;
}

function presentation(
  stream: OutStream,
  env: Runtime["env"],
  option: boolean | undefined,
  accessible: boolean,
): Presentation {
  const capable = stream.isTTY && env.TERM !== "dumb";
  const preference = colorPreference(env, option);
  const width = stream.isTTY && stream.columns && stream.columns > 0 ? stream.columns : 80;
  return {
    isTTY: stream.isTTY,
    rich: capable && !accessible,
    color: preference ?? capable,
    detectedColor: preference === false ? false : capable,
    width,
  };
}

export function resolveModes(runtime: Runtime, options: ModeOptions): Modes {
  const { env } = runtime;
  const ci = isTruthyFlag(env.CI);
  const agent = detectAgent(env);
  const accessible = isTruthyFlag(env.FCSIA_ACCESSIBLE);
  const json = options.json === true;
  const terminal = runtime.stdinIsTTY && runtime.stderr.isTTY;

  let interactive = terminal && !json && !ci && !agent;
  if (options.nonInteractive === true) interactive = false;
  // An explicit `--non-interactive=false` restores prompts for an agent's user
  // at a real terminal, but never in CI, with JSON, or without a TTY.
  if (options.nonInteractive === false && terminal && !json && !ci) interactive = true;

  return {
    interactive,
    format: json ? "json" : "human",
    stdout: presentation(runtime.stdout, env, options.color, accessible),
    stderr: presentation(runtime.stderr, env, options.color, accessible),
    consent: options.yes === true,
    ci,
    agent,
    accessible,
    guidance: !isTruthyFlag(env.FCSIA_GUIDANCE_DISABLED),
    debug: options.debug === true,
  };
}
