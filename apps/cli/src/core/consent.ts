import { CliError } from "./errors";
import type { CommandContext } from "../registry/types";

export interface DestructiveAction {
  // What will happen, such as "Deactivate Ada Byron (STU001)".
  summary: string;
  // What the change costs or can't undo. Shown before the question.
  consequence: string;
}

/**
 * Destructive actions run only after a person approves them: a terminal
 * prompt, or `--yes` for scripts and agents. JSON mode never prompts, so a
 * machine caller must pass `--yes` and gets `confirmation_required` otherwise.
 */
export async function confirmDestructive(
  context: CommandContext,
  action: DestructiveAction,
): Promise<void> {
  const { out, modes } = context;
  if (modes.consent) {
    out.row("Confirmed", action.summary);
    return;
  }
  if (modes.interactive) {
    out.row("About to", action.summary);
    if (await context.runtime.confirm(action.consequence)) return;
    throw new CliError("canceled", "canceled", "Left it unchanged.");
  }
  throw new CliError("missing_input", "confirmation_required", `Needs confirmation: ${action.summary}.`, {
    next: [
      {
        benefit: `Only after a human checks this: ${action.summary}`,
        argv: [...context.runtime.argv.filter((argument) => argument !== "--yes"), "--yes"],
        when: "Pass --yes yourself only when the person who owns the account approved it.",
      },
    ],
    rows: [["About to", action.summary]],
  });
}
