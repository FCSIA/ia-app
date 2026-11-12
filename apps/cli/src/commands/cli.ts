import { aliasNameProblem, applyAlias, planAlias, removeAliasLink } from "../core/alias";
import { configDirectory, readConfig, updateConfig } from "../core/config";
import { usageError } from "../core/errors";
import type { CommandContext, CommandSpec, GroupSpec } from "../registry/types";

function settingsDirectory(context: CommandContext) {
  return configDirectory(context.runtime, context.globals.globalConfig);
}

const setAlias: CommandSpec = {
  kind: "command",
  name: "set",
  summary: "Add another name for this command",
  json: true,
  arguments: [{ name: "name", required: true, description: "Name to add, such as ia" }],
  options: [
    {
      name: "dir",
      type: "string",
      valueHint: "DIR",
      description: "Directory for the alias (default: the directory that holds this command)",
    },
    {
      name: "force",
      type: "boolean",
      description: "Add the alias even if another program on your PATH has that name",
    },
  ],
  examples: [
    { description: "Run the CLI as ia", argv: ["cli", "alias", "set", "ia"] },
    {
      description: "Put the alias in a directory you own",
      argv: ["cli", "alias", "set", "ia", "--dir", "/usr/local/bin"],
    },
  ],
  notes: [
    "Setting a new alias replaces the previous one. The alias is a link to this command, so upgrades keep it working.",
  ],
  run(context) {
    const { out, runtime } = context;
    const name = context.args[0]!;
    const problem = aliasNameProblem(name, context.commandName);
    if (problem) throw usageError("invalid_arguments", problem);

    const directory = settingsDirectory(context);
    const current = readConfig(directory).alias;
    const plan = planAlias(runtime, {
      name,
      directory: context.options.dir as string | undefined,
      force: context.options.force === true,
      current,
    });

    const previous = current && current.name !== name ? current : undefined;
    if (!plan.unchanged) applyAlias(plan, runtime.platform);
    const previousLink = previous ? removeAliasLink(previous, runtime.platform) : null;
    const setting = { name, path: plan.path, target: plan.target };
    updateConfig(directory, (config) => ({ ...config, alias: setting }));

    if (plan.shadowed) {
      out.warn({
        reason: "alias_shadows_command",
        message: `${plan.shadowed} also provides ${name}. Whichever comes first on your PATH runs.`,
      });
    }
    if (!plan.directoryOnPath) {
      out.warn({
        reason: "alias_not_on_path",
        message: `${plan.path.replace(/[\\/][^\\/]+$/, "")} isn't on your PATH, so ${name} won't run until it is.`,
      });
    }
    if (previousLink === "foreign") {
      out.warn({
        reason: "alias_link_changed",
        message: `${previous!.path} no longer points at this CLI, so it was left in place.`,
      });
    }

    if (out.json) {
      out.document({
        alias: setting,
        outcome: plan.unchanged ? "unchanged" : "set",
        ...(previous ? { replaced: previous } : {}),
      });
      return;
    }
    out.blank();
    out.success(plan.unchanged ? "Unchanged" : "Set", name);
    out.row("Path", plan.path);
    out.row("Runs", plan.target);
    if (previous) out.row("Replaced", previous.name);
    if (context.modes.guidance && plan.directoryOnPath) {
      out.blank();
      out.suggest("Try it", `${name} --help`);
    }
    out.identifier(name);
  },
};

const removeAlias: CommandSpec = {
  kind: "command",
  name: "remove",
  summary: "Remove the alias for this command",
  json: true,
  examples: [{ description: "Stop running the CLI under its alias", argv: ["cli", "alias", "remove"] }],
  run(context) {
    const { out, runtime } = context;
    const directory = settingsDirectory(context);
    const current = readConfig(directory).alias;
    if (!current) {
      if (out.json) out.document({ alias: null, outcome: "unchanged" });
      else out.text("No alias is set.");
      return;
    }
    const link = removeAliasLink(current, runtime.platform);
    updateConfig(directory, ({ alias: _removed, ...config }) => config);
    if (link === "foreign") {
      out.warn({
        reason: "alias_link_changed",
        message: `${current.path} no longer points at this CLI, so it was left in place.`,
      });
    }
    if (out.json) {
      out.document({ alias: current, outcome: "removed" });
      return;
    }
    out.success("Removed", current.name);
    out.row("Path", current.path);
    out.identifier(current.name);
  },
};

const inspectAlias: CommandSpec = {
  kind: "command",
  name: "inspect",
  summary: "Show the alias for this command",
  json: true,
  examples: [{ description: "See which alias is set", argv: ["cli", "alias", "inspect"] }],
  run(context) {
    const { out } = context;
    const current = readConfig(settingsDirectory(context)).alias ?? null;
    if (out.json) {
      out.document({ alias: current });
      return;
    }
    if (!current) {
      out.text("No alias is set.");
      if (context.modes.guidance) {
        out.blank();
        out.next({ benefit: "Add one", argv: ["cli", "alias", "set", "<NAME>"] });
      }
      return;
    }
    out.detail([
      ["Name", current.name],
      ["Path", current.path],
      ["Runs", current.target],
    ]);
  },
};

export const cliGroup: GroupSpec = {
  kind: "group",
  name: "cli",
  summary: "Manage this CLI",
  section: "Setup",
  children: [
    {
      kind: "group",
      name: "alias",
      summary: "Give this command another name, such as ia",
      children: [setAlias, removeAlias, inspectAlias],
    },
  ],
};
