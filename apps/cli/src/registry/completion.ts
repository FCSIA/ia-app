import { usageError } from "../core/errors";
import { GLOBAL_OPTIONS, JSON_OPTION } from "./globals";
import { isListed } from "./help";
import { findChild } from "./parse";
import type { CommandSpec, GroupSpec, Node, OptionSpec } from "./types";

export const COMPLETION_SHELLS = ["bash", "zsh", "fish"] as const;
export type CompletionShell = (typeof COMPLETION_SHELLS)[number];

export interface Candidate {
  value: string;
  // Everything after the first tab on a line. Shells that show descriptions
  // use it; Bash keeps only the value.
  description: string;
}

function oneLine(text: string) {
  return text.replace(/[\t\r\n]+/g, " ").trim();
}

function commandOptions(command: CommandSpec | null) {
  return [
    ...GLOBAL_OPTIONS,
    ...(command?.json ? [JSON_OPTION] : []),
    ...(command?.options ?? []),
  ];
}

function longName(option: OptionSpec) {
  return `--${option.helpName ?? option.name}`;
}

function optionCandidates(options: OptionSpec[]): Candidate[] {
  return options.flatMap((option) => [
    { value: longName(option), description: option.description },
    ...(option.short ? [{ value: `-${option.short}`, description: option.description }] : []),
  ]);
}

function findOption(options: OptionSpec[], token: string) {
  return options.find(
    (option) => longName(option) === token || (option.short ? `-${option.short}` === token : false),
  );
}

interface Resolved {
  node: Node;
  command: CommandSpec | null;
}

// Walks the words already finished, stopping at the first word that is not a
// command or a known option. Completion never guesses past a typo.
function resolve(root: GroupSpec, completed: string[]): Resolved | null {
  let node: Node = root;
  let command: CommandSpec | null = null;
  for (let index = 0; index < completed.length; index += 1) {
    const token = completed[index]!;
    const options = commandOptions(command);
    if (token.startsWith("-") && token !== "-") {
      const option = findOption(options, token.split("=")[0]!);
      if (option?.type === "string" && !token.includes("=") && index + 1 < completed.length) {
        index += 1;
      }
      continue;
    }
    if (command) return null;
    if (node.kind !== "group") return null;
    const child = findChild(node, token);
    if (!child) return null;
    node = child;
    if (child.kind === "command") command = child;
  }
  return { node, command };
}

/**
 * The words a shell has typed so far, with the last one being the partial
 * word under the cursor. Paths and option values are files, so they are left
 * to the shell's own completion.
 */
export function completionCandidates(root: GroupSpec, words: string[]): Candidate[] {
  const current = words.at(-1) ?? "";
  const resolved = resolve(root, words.slice(0, -1));
  if (!resolved) return [];
  const { node, command } = resolved;

  if (current.startsWith("-") && current !== "-") {
    return optionCandidates(commandOptions(command))
      .filter((candidate) => candidate.value.startsWith(current))
      .map((candidate) => ({ ...candidate, description: oneLine(candidate.description) }))
      .sort((left, right) => left.value.localeCompare(right.value));
  }

  if (command || node.kind !== "group") return [];
  return node.children
    .filter((child) => isListed(child) && child.name.startsWith(current))
    .map((child) => ({ value: child.name, description: oneLine(child.summary) }));
}

export function completionShell(input: string): CompletionShell {
  const shell = COMPLETION_SHELLS.find((candidate) => candidate === input);
  if (!shell) {
    throw usageError(
      "invalid_shell",
      `${input} isn't a supported shell. Use ${COMPLETION_SHELLS.join(", ")}.`,
    );
  }
  return shell;
}

// Each script asks the CLI for candidates, so new commands appear without
// regenerating or reinstalling completions.
export function completionScript(shell: CompletionShell, commandName: string) {
  switch (shell) {
    case "bash":
      return `# Add to ~/.bashrc: eval "$(${commandName} completion bash)"
_${commandName}() {
  local line value description
  COMPREPLY=()
  while IFS=$'\\t' read -r value description; do
    [[ -n $value ]] && COMPREPLY+=("$value")
  done < <(${commandName} __complete -- "\${COMP_WORDS[@]:1:COMP_CWORD}")
  return 0
}
complete -o default -F _${commandName} ${commandName}
`;
    case "zsh":
      return `#compdef ${commandName}
# Save as _${commandName} in a directory on your fpath, then restart zsh.

_${commandName}() {
  local line value description
  local -a values descriptions
  while IFS=$'\\t' read -r value description; do
    [[ -n $value ]] || continue
    values+=("$value")
    descriptions+=("$description")
  done < <(${commandName} __complete -- "\${words[2,$CURRENT]}")
  if (( \${#values} )); then
    compadd -d descriptions -a values
  elif [[ $PREFIX != -* ]]; then
    _files
  fi
}

_${commandName} "$@"
`;
    case "fish":
      return `# Save as ~/.config/fish/completions/${commandName}.fish
function __${commandName}_complete
    set -l tokens (commandline -opc)
    set -l current (commandline -ct)
    ${commandName} __complete -- $tokens[2..-1] "$current"
end
complete -c ${commandName} -a '(__${commandName}_complete)'
`;
  }
}
