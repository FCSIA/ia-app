import { parseArgs, type ParseArgsConfig } from "node:util";
import { usageError } from "../core/errors";
import { GLOBAL_OPTIONS, JSON_OPTION, readGlobals } from "./globals";
import { closestMatch } from "./suggest";
import type {
  CommandSpec,
  GlobalValues,
  GroupSpec,
  Node,
  OptionSpec,
  OptionValue,
} from "./types";

export interface Invocation {
  mode: "run" | "help" | "version";
  node: Node;
  command: CommandSpec | null;
  path: string[];
  args: string[];
  options: Record<string, OptionValue>;
  globals: GlobalValues;
}

interface Route {
  node: Node;
  command: CommandSpec | null;
  path: string[];
  rest: string[];
  unknownSegment: string | null;
}

export function findChild(group: GroupSpec, token: string) {
  return group.children.find(
    (child) => child.name === token || child.aliases?.includes(token),
  );
}

function globalSpec(token: string) {
  const name = token.startsWith("--") ? token.slice(2).split("=")[0] : null;
  if (name !== null) return GLOBAL_OPTIONS.find((option) => option.name === name);
  const short = token.length === 2 ? token[1] : null;
  return GLOBAL_OPTIONS.find((option) => option.short === short);
}

// Parent commands parse permissively only to route. Positionals walk the tree;
// option tokens are set aside for the leaf's strict parse.
export function route(root: GroupSpec, argv: string[]): Route {
  let node: Node = root;
  let command: CommandSpec | null = null;
  const path: string[] = [];
  const rest: string[] = [];
  let unknownSegment: string | null = null;
  let endOfOptions = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (endOfOptions) {
      rest.push(token);
      continue;
    }
    if (token === "--") {
      endOfOptions = true;
      rest.push(token);
      continue;
    }
    if (token.startsWith("-") && token !== "-") {
      rest.push(token);
      const spec = command ? null : globalSpec(token);
      if (spec?.type === "string" && !token.includes("=") && index + 1 < argv.length) {
        rest.push(argv[(index += 1)]!);
      }
      continue;
    }
    if (command || unknownSegment !== null) {
      rest.push(token);
      continue;
    }
    if (node.kind === "group") {
      const child = findChild(node, token);
      if (child) {
        node = child;
        path.push(child.name);
        if (child.kind === "command") command = child;
        continue;
      }
      if (node.defaultCommand) {
        command = node.defaultCommand;
        rest.push(token);
        continue;
      }
      unknownSegment = token;
      continue;
    }
  }

  if (!command && node.kind === "group" && node.defaultCommand && unknownSegment === null) {
    command = node.defaultCommand;
  }
  return { node, command, path, rest, unknownSegment };
}

function scanFlags(argv: string[]) {
  const end = argv.indexOf("--");
  const head = end === -1 ? argv : argv.slice(0, end);
  return {
    help: head.some((token) => token === "-h" || token === "--help"),
    version: head.some((token) => token === "-v" || token === "--version"),
    json: head.includes("--json"),
  };
}

export function commandOptions(command: CommandSpec | null): OptionSpec[] {
  const own = command?.options ?? [];
  return [...GLOBAL_OPTIONS, ...(command?.json ? [JSON_OPTION] : []), ...own];
}

function optionLabel(option: OptionSpec) {
  return `--${option.helpName ?? option.name}`;
}

// `--feature=true` and `--feature=false` parse as presence and negation.
function normalizeBooleanValues(tokens: string[], options: OptionSpec[]) {
  return tokens.map((token) => {
    const match = /^--([a-z0-9-]+)=(true|false)$/.exec(token);
    if (!match) return token;
    const option = options.find((candidate) => candidate.name === match[1]);
    if (option?.type !== "boolean") return token;
    return match[2] === "true" ? `--${option.name}` : `--no-${option.name}`;
  });
}

function unknownOptionError(
  raw: string,
  options: OptionSpec[],
  commandLabel: string,
  helpArgv: string[],
  tokens: string[],
) {
  const name = raw.replace(/^-+/, "").split("=")[0]!;
  const suggestion = closestMatch(
    name,
    options.filter((option) => !option.hidden).map((option) => option.helpName ?? option.name),
  );
  return usageError("unknown_option", `Unknown option ${raw} for ${commandLabel}.`, {
    next: [
      ...(suggestion
        ? [
            {
              benefit: `Use --${suggestion}`,
              argv: [
                ...helpArgv,
                ...tokens.map((token) => (token.split("=")[0] === raw ? `--${suggestion}` : token)),
              ],
            },
          ]
        : []),
      { benefit: "See the options", argv: [...helpArgv, "--help"] },
    ],
  });
}

function parseLeaf(
  command: CommandSpec | null,
  path: string[],
  tokens: string[],
  commandName: string,
) {
  const options = commandOptions(command);
  const commandLabel = [commandName, ...path].join(" ");
  const config: ParseArgsConfig["options"] = {};
  for (const option of options) {
    config[option.name] = {
      type: option.type,
      ...(option.short ? { short: option.short } : {}),
      multiple: true,
    };
  }

  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: normalizeBooleanValues(tokens, options),
      options: config,
      strict: true,
      allowPositionals: true,
      allowNegative: true,
      tokens: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = (error as { code?: string }).code;
    const raw = /'([^' ]+)/.exec(message)?.[1] ?? "";
    if (code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
      throw unknownOptionError(raw, options, commandLabel, path, tokens);
    }
    if (message.includes("does not take an argument")) {
      throw usageError("invalid_arguments", `${raw} doesn't take a value.`);
    }
    if (message.includes("argument missing")) {
      throw usageError("invalid_arguments", `Missing a value for ${raw}.`);
    }
    if (message.includes("ambiguous")) {
      throw usageError("invalid_arguments", `Can't read the value for ${raw}. Use ${raw}=<VALUE>.`);
    }
    throw usageError("invalid_arguments", message);
  }

  const values: Record<string, OptionValue> = {};
  for (const option of options) {
    const value = (parsed.values as Record<string, Array<string | boolean> | undefined>)[option.name];
    if (value === undefined) continue;
    const repeat = option.repeat ?? "error";
    if (value.length > 1 && repeat === "error") {
      throw usageError("invalid_arguments", `Can't use ${optionLabel(option)} more than once.`);
    }
    if (repeat === "append") values[option.name] = value.map(String);
    else values[option.name] = value[value.length - 1];
  }
  return { values, positionals: parsed.positionals };
}

function validatePositionals(command: CommandSpec, path: string[], positionals: string[], commandName: string) {
  const specs = command.arguments ?? [];
  const variadic = specs.at(-1)?.variadic === true;
  const required = specs.filter((spec) => spec.required);
  if (positionals.length < required.length) {
    const missing = required[positionals.length]!;
    throw usageError("invalid_arguments", `Missing <${missing.name}> for ${[commandName, ...path].join(" ")}.`, {
      next: [{ benefit: "See how to use it", argv: [...path, "--help"] }],
    });
  }
  if (!variadic && positionals.length > specs.length) {
    const extra = positionals[specs.length]!;
    throw usageError(
      "invalid_arguments",
      `Unexpected argument ${extra} for ${[commandName, ...path].join(" ")}.`,
      { next: [{ benefit: "See how to use it", argv: [...path, "--help"] }] },
    );
  }
}

// Group help must render even beside options meant for a leaf, so read the
// globals without rejecting anything.
function lenientGlobals(tokens: string[]) {
  const config: ParseArgsConfig["options"] = {};
  for (const option of [...GLOBAL_OPTIONS, JSON_OPTION]) {
    config[option.name] = { type: option.type, ...(option.short ? { short: option.short } : {}) };
  }
  const { values } = parseArgs({
    args: tokens,
    options: config,
    strict: false,
    allowPositionals: true,
    allowNegative: true,
  });
  const known: Record<string, OptionValue> = {};
  for (const [name, value] of Object.entries(values)) {
    const spec = config[name];
    if (!spec) continue;
    if (typeof value === (spec.type === "boolean" ? "boolean" : "string")) {
      known[name] = value as OptionValue;
    }
  }
  return readGlobals({ ...known, help: true });
}

export function parseInvocation(root: GroupSpec, argv: string[], commandName: string): Invocation {
  const flags = scanFlags(argv);
  const routed = route(root, argv);

  if (routed.unknownSegment !== null) {
    const parent = routed.node as GroupSpec;
    const names = parent.children.flatMap((child) => [child.name, ...(child.aliases ?? [])]);
    const suggestion = closestMatch(routed.unknownSegment, names);
    const parentLabel = [commandName, ...routed.path].join(" ");
    throw usageError(
      "unknown_command",
      `Unknown command ${routed.unknownSegment} for ${parentLabel}.`,
      {
        next: [
          ...(suggestion
            ? [{ benefit: `Run ${suggestion} instead`, argv: [...routed.path, suggestion] }]
            : []),
          { benefit: "See the commands", argv: [...routed.path, "--help"] },
        ],
      },
    );
  }

  const base = { node: routed.node, path: routed.path, args: [], options: {} };
  if (flags.help) {
    return { ...base, mode: "help", command: null, globals: lenientGlobals(routed.rest) };
  }

  // A group invoked without an action shows its help and exits 0.
  if (!routed.command) {
    if (flags.version) {
      return { ...base, mode: "version", command: null, globals: readGlobals({ version: true, json: flags.json }) };
    }
    return { ...base, mode: "help", command: null, globals: lenientGlobals(routed.rest) };
  }

  const { values, positionals } = parseLeaf(routed.command, routed.path, routed.rest, commandName);
  const globals = readGlobals(values);
  if (globals.version) {
    return { ...base, mode: "version", command: routed.command, globals };
  }
  validatePositionals(routed.command, routed.path, positionals, commandName);
  return {
    mode: "run",
    node: routed.node,
    command: routed.command,
    path: routed.path,
    args: positionals,
    options: values,
    globals,
  };
}
