import type { GlobalValues, OptionSpec, OptionValue } from "./types";

// Accepted at every depth. None of them makes help or local work need network.
export const GLOBAL_OPTIONS: OptionSpec[] = [
  { name: "help", short: "h", type: "boolean", description: "Show help for a command" },
  { name: "version", short: "v", type: "boolean", description: "Print the CLI version" },
  { name: "debug", short: "d", type: "boolean", description: "Print redacted diagnostics on stderr" },
  { name: "color", helpName: "no-color", type: "boolean", description: "Turn off color" },
  {
    name: "non-interactive",
    type: "boolean",
    description: "Never prompt; fail with the input that is missing",
  },
  {
    name: "global-config",
    type: "string",
    valueHint: "DIR",
    description: "Directory for CLI settings and sign-ins",
  },
  {
    name: "host",
    type: "string",
    valueHint: "URL",
    description: "IA App site to use",
    default: "https://app.fcsia.com",
  },
  {
    name: "token",
    type: "string",
    valueHint: "TOKEN",
    description: "Session token to use; prefer the FCSIA_TOKEN variable",
  },
  {
    name: "yes",
    short: "y",
    type: "boolean",
    description: "Approve a destructive action without asking",
  },
];

// Commands that support --json declare it with this shared option.
export const JSON_OPTION: OptionSpec = {
  name: "json",
  type: "boolean",
  description: "Output the result as JSON",
};

export function readGlobals(values: Record<string, OptionValue>): GlobalValues {
  const flag = (name: string) => values[name] === true;
  const optionalFlag = (name: string) =>
    typeof values[name] === "boolean" ? (values[name] as boolean) : undefined;
  const text = (name: string) =>
    typeof values[name] === "string" ? (values[name] as string) : undefined;
  return {
    help: flag("help"),
    version: flag("version"),
    json: flag("json"),
    nonInteractive: optionalFlag("non-interactive"),
    color: optionalFlag("color"),
    debug: flag("debug"),
    globalConfig: text("global-config"),
    host: text("host"),
    token: text("token"),
  };
}
