const SAFE_ARGUMENT = /^[A-Za-z0-9_@%+=:,./-]+$/;
const PLACEHOLDER = /^<[A-Z][A-Z0-9_]*>(\.\.\.)?$/;

// Quote one argument so it pastes into POSIX shells, Nushell, and PowerShell.
// Placeholders such as <NAME> stay bare because they are meant to be replaced.
export function quoteArgument(argument: string) {
  if (argument === "") return "''";
  if (SAFE_ARGUMENT.test(argument) || PLACEHOLDER.test(argument)) return argument;
  return `'${argument.replace(/'/g, `'"'"'`)}'`;
}

export function formatCommand(commandName: string, argv: string[]) {
  return [commandName, ...argv].map(quoteArgument).join(" ");
}
