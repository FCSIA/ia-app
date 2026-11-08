import { usageError } from "../core/errors";
import { createTheme } from "../core/theme";
import { helpDocument, listCommands, renderHelp } from "../registry/help";
import { route } from "../registry/parse";
import type { CommandContext, CommandSpec, GroupSpec, Node } from "../registry/types";

export function helpTheme(context: Pick<CommandContext, "modes">) {
  // Help is styled only for a detected color terminal, never when forced.
  const { stdout } = context.modes;
  return createTheme(stdout.detectedColor && stdout.color && stdout.isTTY, stdout.rich);
}

export function printHelp(context: CommandContext, node: Node, path: string[]) {
  if (context.globals.json) {
    context.out.print(JSON.stringify({ command: helpDocument(node, path, context.commandName) }, null, context.modes.stdout.isTTY ? 2 : undefined));
    return;
  }
  context.out.print(
    renderHelp(node, path, context.root, {
      commandName: context.commandName,
      theme: helpTheme(context),
      width: context.modes.stdout.width,
    }).trimEnd(),
  );
}

function table(context: CommandContext, rows: Array<[string, string]>, headers: [string, string]) {
  const { out } = context;
  if (!context.modes.stdout.isTTY) {
    out.print(headers.join("\t"));
    for (const row of rows) out.print(row.join("\t"));
    return;
  }
  const width = Math.max(headers[0].length, ...rows.map(([left]) => left.length)) + 3;
  out.print(`  ${headers[0].padEnd(width)}${headers[1]}`);
  for (const [left, right] of rows) out.print(`  ${left.padEnd(width)}${right}`);
}

const showHelp: CommandSpec = {
  kind: "command",
  name: "help",
  summary: "Show help for a command",
  json: true,
  arguments: [{ name: "command", required: false, variadic: true, description: "Command path, such as cli alias set" }],
  options: [{ name: "all", type: "boolean", description: "List every command" }],
  examples: [
    { description: "Show help for a command", argv: ["help", "cli", "alias", "set"] },
    { description: "Read every command's help as JSON", argv: ["help", "--all", "--json"] },
  ],
  run(context) {
    const { root, commandName } = context;
    if (context.options.all === true) {
      const commands = listCommands(root);
      if (context.globals.json) {
        context.out.document({
          commands: commands.map(({ node, path }) => helpDocument(node, path, commandName)),
        });
        return;
      }
      table(
        context,
        commands.map(({ node, path }) => [[commandName, ...path].join(" "), node.summary]),
        ["Command", "Summary"],
      );
      return;
    }
    const routed = route(root, context.args);
    if (routed.unknownSegment !== null) {
      throw usageError(
        "unknown_command",
        `Unknown command ${routed.unknownSegment} for ${[commandName, ...routed.path].join(" ")}.`,
        { next: [{ benefit: "See the commands", argv: [...routed.path, "--help"] }] },
      );
    }
    printHelp(context, routed.node, routed.path);
  },
};

function score(query: string[], path: string[], summary: string) {
  const words = summary.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let total = 0;
  for (const term of query) {
    if (path.includes(term)) total += 5;
    else if (path.some((segment) => segment.startsWith(term))) total += 3;
    if (words.includes(term)) total += 2;
    else if (words.some((word) => word.startsWith(term))) total += 1;
  }
  return total;
}

const searchHelp: CommandSpec = {
  kind: "command",
  name: "search",
  summary: "Find commands by what they do",
  json: true,
  arguments: [{ name: "query", required: true, variadic: true, description: "Words to look for" }],
  examples: [{ description: "Find the command that renames the CLI", argv: ["help", "search", "alias"] }],
  notes: ["Search runs offline and never records the query."],
  run(context) {
    const query = context.args.join(" ").toLowerCase().split(/\s+/).filter(Boolean);
    const matches = listCommands(context.root)
      .map(({ node, path }) => ({ path, summary: node.summary, score: score(query, path, node.summary) }))
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score || a.path.join(" ").localeCompare(b.path.join(" ")))
      .slice(0, 10);

    const label = (path: string[]) => [context.commandName, ...path].join(" ");
    if (context.globals.json) {
      context.out.document({
        commands: matches.map((match) => ({ path: match.path.join(" "), summary: match.summary })),
      });
      return;
    }
    if (matches.length === 0) {
      context.out.text(`No commands match "${context.args.join(" ")}".`);
      return;
    }
    table(context, matches.map((match) => [label(match.path), match.summary]), ["Command", "Summary"]);
  },
};

export const helpGroup: GroupSpec = {
  kind: "group",
  name: "help",
  summary: "Show help for a command",
  section: "Setup",
  children: [searchHelp],
  defaultCommand: showHelp,
};
