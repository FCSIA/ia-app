import { createRootCommand } from "./commands";
import { printHelp } from "./commands/help";
import { CliError, internalError } from "./core/errors";
import { resolveModes } from "./core/modes";
import { Output } from "./core/output";
import { cliVersion, invokedCommandName, type Runtime } from "./core/runtime";
import { parseInvocation } from "./registry/parse";
import type { CommandContext, GroupSpec } from "./registry/types";

function earlyModes(runtime: Runtime) {
  const end = runtime.argv.indexOf("--");
  const head = end === -1 ? runtime.argv : runtime.argv.slice(0, end);
  return resolveModes(runtime, {
    json: head.includes("--json"),
    color: head.includes("--no-color") ? false : undefined,
  });
}

export async function runCli(runtime: Runtime, root: GroupSpec = createRootCommand()): Promise<number> {
  const commandName = invokedCommandName(runtime);
  const version = cliVersion();

  let invocation;
  try {
    invocation = parseInvocation(root, runtime.argv, commandName);
  } catch (error) {
    const out = new Output(runtime, earlyModes(runtime), commandName);
    if (error instanceof CliError) {
      out.error(error);
      return error.exitCode;
    }
    const failure = internalError(commandName, error, runtime.argv);
    out.error(failure);
    return failure.exitCode;
  }

  const { globals } = invocation;
  const modes = resolveModes(runtime, {
    json: globals.json,
    nonInteractive: globals.nonInteractive,
    color: globals.color,
    debug: globals.debug,
    yes: invocation.options.yes === true,
  });
  const out = new Output(runtime, modes, commandName);
  const context: CommandContext = {
    runtime,
    modes,
    out,
    commandName,
    path: invocation.path,
    args: invocation.args,
    options: invocation.options,
    globals,
    root,
    version,
  };

  if (invocation.mode === "version") {
    out.print(globals.json ? JSON.stringify({ version }) : version);
    return 0;
  }
  if (invocation.mode === "help") {
    printHelp(context, invocation.node, invocation.path);
    return 0;
  }

  try {
    await invocation.command!.run(context);
    return 0;
  } catch (error) {
    if (error instanceof CliError) {
      out.error(error);
      return error.exitCode;
    }
    const failure = internalError([commandName, ...invocation.path].join(" "), error, runtime.argv);
    if (modes.debug && error instanceof Error && error.stack) runtime.stderr.write(`${error.stack}\n`);
    out.error(failure);
    return failure.exitCode;
  }
}
