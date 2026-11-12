import { formatCommand } from "../core/shell";
import type { Theme } from "../core/theme";
import { visibleLength } from "../core/theme";
import { GLOBAL_OPTIONS, JSON_OPTION } from "./globals";
import type { ArgumentSpec, CommandSpec, GroupSpec, Lifecycle, Node, OptionSpec } from "./types";

export interface HelpContext {
  commandName: string;
  theme: Theme;
  width: number;
}

const MAX_LEFT_COLUMN = 28;

export function isListed(node: Node) {
  const label = node.lifecycle?.label;
  return label !== "hidden" && label !== "deprecated" && label !== "experimental";
}

export function lifecycleText(lifecycle: Lifecycle | undefined) {
  switch (lifecycle?.label) {
    case "preview":
      return "(preview)";
    case "beta":
      return `(beta: ${lifecycle.limit})`;
    case "experimental":
      return "(experimental)";
    default:
      return "";
  }
}

function argumentUsage(spec: ArgumentSpec) {
  const base = spec.required ? `<${spec.name}>` : `[${spec.name}]`;
  return spec.variadic ? `${base}...` : base;
}

function runnable(node: Node): CommandSpec | null {
  if (node.kind === "command") return node;
  return node.defaultCommand ?? null;
}

export function usage(node: Node, path: string[], commandName: string) {
  const parts = [commandName, ...path];
  const command = runnable(node);
  if (node.kind === "group" && !command) parts.push("<command>");
  for (const spec of command?.arguments ?? []) parts.push(argumentUsage(spec));
  if (node.kind === "group" && command) parts.push("[command]");
  parts.push("[options]");
  return parts.join(" ");
}

function optionLeft(option: OptionSpec) {
  const long = `--${option.helpName ?? option.name}`;
  const hint = option.type === "string" ? ` <${option.valueHint ?? "VALUE"}>` : "";
  return option.short ? `-${option.short}, ${long}${hint}` : `${long}${hint}`;
}

function optionRight(option: OptionSpec) {
  return option.default ? `${option.description} (default: ${option.default})` : option.description;
}

function wrap(text: string, width: number) {
  if (width <= 0 || text.length <= width) return [text];
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Borderless two-column table. Syntax is never truncated; a description that
// doesn't fit beside it moves below.
function columns(rows: Array<[left: string, right: string]>, context: HelpContext, indent = 2) {
  const widest = Math.max(0, ...rows.map(([left]) => visibleLength(left)));
  const leftWidth = Math.min(widest + 2, MAX_LEFT_COLUMN);
  const pad = " ".repeat(indent);
  const lines: string[] = [];
  for (const [left, right] of rows) {
    const leftLength = visibleLength(left);
    const available = context.width - indent - leftWidth;
    if (leftLength + 2 <= leftWidth && available >= 24) {
      const [first, ...more] = wrap(right, available);
      lines.push(`${pad}${left}${" ".repeat(leftWidth - leftLength)}${first ?? ""}`.trimEnd());
      for (const line of more) lines.push(`${pad}${" ".repeat(leftWidth)}${line}`);
    } else {
      lines.push(`${pad}${left}`);
      for (const line of wrap(right, context.width - indent - 4)) lines.push(`${pad}    ${line}`);
    }
  }
  return lines;
}

function commandRows(group: GroupSpec, context: HelpContext): Array<[string, string]> {
  return group.children.filter(isListed).map((child) => {
    const label = lifecycleText(child.lifecycle);
    return [context.theme.bold(child.name), label ? `${child.summary} ${label}` : child.summary];
  });
}

function optionRows(options: OptionSpec[], context: HelpContext): Array<[string, string]> {
  return [...options]
    .filter((option) => !option.hidden)
    .sort((a, b) => (a.helpName ?? a.name).localeCompare(b.helpName ?? b.name))
    .map((option) => [context.theme.bold(optionLeft(option)), optionRight(option)]);
}

export function renderHelp(node: Node, path: string[], root: GroupSpec, context: HelpContext) {
  const { theme, commandName } = context;
  const command = runnable(node);
  const isRoot = path.length === 0;
  const sections: string[][] = [];

  const label = lifecycleText(node.lifecycle);
  const summary = isRoot ? root.summary : node.summary;
  sections.push([
    theme.bold(usage(node, path, commandName)),
    label ? `${theme.faint(summary)} ${label}` : theme.faint(summary),
  ]);

  if (node.kind === "group") {
    if (isRoot) {
      const order: string[] = [];
      const bySection = new Map<string, Node[]>();
      for (const child of node.children.filter(isListed)) {
        const heading = child.section ?? "Other";
        if (!bySection.has(heading)) {
          bySection.set(heading, []);
          order.push(heading);
        }
        bySection.get(heading)!.push(child);
      }
      for (const heading of order) {
        const children = bySection.get(heading)!;
        sections.push([
          theme.heading(`${heading}:`),
          ...columns(commandRows({ ...node, children }, context), context),
        ]);
      }
    } else {
      sections.push([theme.heading("Commands:"), ...columns(commandRows(node, context), context)]);
    }
  }

  if (command?.arguments?.length) {
    sections.push([
      theme.heading("Arguments:"),
      ...columns(
        command.arguments.map((spec) => [theme.bold(argumentUsage(spec)), spec.description]),
        context,
      ),
    ]);
  }

  const own = [...(command?.json ? [JSON_OPTION] : []), ...(command?.options ?? [])];
  if (own.length > 0) {
    sections.push([theme.heading("Options:"), ...columns(optionRows(own, context), context)]);
  }

  if (isRoot) {
    sections.push([theme.heading("Global Options:"), ...columns(optionRows(GLOBAL_OPTIONS, context), context)]);
  } else {
    sections.push([`${theme.heading("Global Options:")} See \`${commandName} --help\``]);
  }

  const examples = command?.examples ?? [];
  if (examples.length > 0) {
    const lines = [theme.heading("Examples:")];
    examples.forEach((example, index) => {
      if (index > 0) lines.push("");
      lines.push(`  ${example.description}`);
      lines.push(`    ${theme.command(formatCommand(commandName, example.argv))}`);
    });
    sections.push(lines);
  }

  if (command?.notes?.length) {
    sections.push([theme.heading("Notes:"), ...command.notes.flatMap((note) => wrap(note, context.width - 2).map((line) => `  ${line}`))]);
  }

  return `${sections.map((lines) => lines.join("\n")).join("\n\n")}\n`;
}

// Machine-readable help: one document per command, from the same metadata.
export function helpDocument(node: Node, path: string[], commandName: string) {
  const command = runnable(node);
  const ownOptions = [...(command?.json ? [JSON_OPTION] : []), ...(command?.options ?? [])];
  return {
    path: path.join(" "),
    usage: usage(node, path, commandName),
    summary: node.summary,
    lifecycle: node.lifecycle?.label ?? "ga",
    json: command?.json === true,
    commands:
      node.kind === "group"
        ? node.children.filter(isListed).map((child) => ({
            path: [...path, child.name].join(" "),
            summary: child.summary,
          }))
        : [],
    arguments: (command?.arguments ?? []).map((spec) => ({
      name: spec.name,
      required: spec.required,
      variadic: spec.variadic === true,
      description: spec.description,
    })),
    options: ownOptions
      .filter((option) => !option.hidden)
      .map((option) => ({
        name: option.helpName ?? option.name,
        short: option.short ?? null,
        type: option.type,
        valueHint: option.type === "string" ? option.valueHint ?? "VALUE" : null,
        default: option.default ?? null,
        repeat: option.repeat ?? "error",
        description: option.description,
      })),
    examples: (command?.examples ?? []).map((example) => ({
      description: example.description,
      command: formatCommand(commandName, example.argv),
      argv: [commandName, ...example.argv],
    })),
  };
}

export interface ListedCommand {
  path: string[];
  node: Node;
}

// Every listed runnable path, depth first, in registry order.
export function listCommands(root: GroupSpec): ListedCommand[] {
  const found: ListedCommand[] = [];
  const visit = (node: Node, path: string[]) => {
    if (path.length > 0 && !isListed(node)) return;
    if (path.length > 0 && runnable(node)) found.push({ path, node });
    if (node.kind === "group") {
      for (const child of node.children) visit(child, [...path, child.name]);
    }
  };
  visit(root, []);
  return found;
}
