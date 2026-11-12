import { COMPLETION_SHELLS, completionCandidates, completionScript, completionShell } from "../registry/completion";
import type { CommandSpec } from "../registry/types";

const completion: CommandSpec = {
  kind: "command",
  name: "completion",
  summary: "Print a shell completion script",
  section: "Setup",
  arguments: [
    {
      name: "shell",
      required: true,
      description: `One of ${COMPLETION_SHELLS.join(", ")}`,
    },
  ],
  examples: [
    { description: "Complete fcsia in Bash", argv: ["completion", "bash"] },
    { description: "Complete fcsia in zsh", argv: ["completion", "zsh"] },
  ],
  notes: [
    "The script asks the CLI for candidates, so completions stay current after an upgrade. It never reads settings or signs in.",
  ],
  run(context) {
    const shell = completionShell(context.args[0]!);
    context.out.print(completionScript(shell, context.commandName).trimEnd());
  },
};

// Called by the generated scripts. Everything after `--` is data: the words
// typed so far, with the partial word last.
const complete: CommandSpec = {
  kind: "command",
  name: "__complete",
  summary: "Print completion candidates for a shell",
  lifecycle: { label: "hidden" },
  arguments: [
    {
      name: "words",
      required: false,
      variadic: true,
      description: "Words typed so far; the last is the partial word",
    },
  ],
  run(context) {
    for (const candidate of completionCandidates(context.root, context.args)) {
      context.out.print(`${candidate.value}\t${candidate.description}`);
    }
  },
};

export const completionCommands = [completion, complete];
