import type { Modes } from "../core/modes";
import type { Output } from "../core/output";
import type { Runtime } from "../core/runtime";

export type Lifecycle =
  | { label: "preview" }
  | { label: "beta"; limit: string }
  | { label: "experimental" }
  | { label: "deprecated"; replacement: string }
  | { label: "hidden" };

export interface OptionSpec {
  // Long name in kebab-case, without dashes.
  name: string;
  short?: string;
  // Name shown in help when it differs, such as "no-color" for "color".
  helpName?: string;
  type: "boolean" | "string";
  description: string;
  // Placeholder for string options, such as "DIR".
  valueHint?: string;
  default?: string;
  // How repeats behave. Boolean and single-value options default to "error".
  repeat?: "error" | "last" | "append";
  hidden?: boolean;
}

export interface ArgumentSpec {
  name: string;
  required: boolean;
  variadic?: boolean;
  description: string;
}

export interface Example {
  description: string;
  argv: string[];
}

export type OptionValue = string | boolean | string[] | undefined;

export interface GlobalValues {
  help: boolean;
  version: boolean;
  json: boolean;
  nonInteractive?: boolean;
  color?: boolean;
  debug: boolean;
  globalConfig?: string;
  host?: string;
  token?: string;
}

export interface CommandContext {
  runtime: Runtime;
  modes: Modes;
  out: Output;
  commandName: string;
  // The canonical path, such as ["cli", "alias", "set"].
  path: string[];
  args: string[];
  options: Record<string, OptionValue>;
  globals: GlobalValues;
  root: GroupSpec;
  version: string;
}

export interface CommandSpec {
  kind: "command";
  name: string;
  summary: string;
  // Root only: the task heading this command is listed under.
  section?: string;
  aliases?: string[];
  lifecycle?: Lifecycle;
  arguments?: ArgumentSpec[];
  options?: OptionSpec[];
  // Whether the command supports --json.
  json?: boolean;
  examples?: Example[];
  notes?: string[];
  run(context: CommandContext): Promise<void> | void;
}

export interface GroupSpec {
  kind: "group";
  name: string;
  summary: string;
  aliases?: string[];
  lifecycle?: Lifecycle;
  // Root only: the task heading this child is listed under.
  section?: string;
  children: Array<CommandSpec | GroupSpec>;
  // Runs when the group receives positionals that match no child, or none.
  defaultCommand?: CommandSpec;
}

export type Node = CommandSpec | GroupSpec;
