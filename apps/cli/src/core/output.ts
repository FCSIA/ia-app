import { CliError, type NextStep } from "./errors";
import type { Modes } from "./modes";
import type { Runtime } from "./runtime";
import { formatCommand } from "./shell";
import { createTheme, type Theme, visibleLength } from "./theme";

const GUTTER = 2;
const LABEL_WIDTH = 16;

export interface Warning {
  reason: string;
  message: string;
}

// stdout is the answer; context, receipts, warnings, errors, and next steps go
// to stderr. With --json, stderr stays empty except for the error document.
export class Output {
  readonly ui: Theme;
  readonly data: Theme;
  private readonly warnings: Warning[] = [];
  private pendingBlank = false;
  private wroteTranscript = false;

  constructor(
    private readonly runtime: Runtime,
    readonly modes: Modes,
    readonly commandName: string,
  ) {
    this.ui = createTheme(modes.stderr.color, modes.stderr.rich);
    this.data = createTheme(modes.stdout.color, modes.stdout.rich);
  }

  get json() {
    return this.modes.format === "json";
  }

  // --- stdout -------------------------------------------------------------

  print(text: string) {
    this.runtime.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
  }

  // A mutation's bare identifier, printed so `id=$(fcsia ...)` works.
  identifier(value: string) {
    if (this.json) return;
    if (!this.modes.stdout.isTTY || !this.modes.interactive) this.print(value);
  }

  document(value: Record<string, unknown>) {
    const withWarnings =
      this.warnings.length > 0 ? { ...value, warnings: this.warnings } : value;
    const indent = this.modes.stdout.isTTY ? 2 : undefined;
    this.print(JSON.stringify(withWarnings, null, indent));
  }

  // --- stderr transcript --------------------------------------------------

  private write(line: string) {
    if (this.json) return;
    if (this.pendingBlank && this.wroteTranscript) this.runtime.stderr.write("\n");
    this.pendingBlank = false;
    this.wroteTranscript = true;
    this.runtime.stderr.write(`${line}\n`);
  }

  // Separates phases: context, input, preview, work, result, next.
  blank() {
    this.pendingBlank = true;
  }

  private indent() {
    return this.ui.rich ? " ".repeat(GUTTER) : "";
  }

  text(line: string) {
    this.write(`${this.indent()}${line}`);
  }

  row(label: string, value: string) {
    const indent = this.indent();
    const fits =
      label.length < LABEL_WIDTH &&
      indent.length + LABEL_WIDTH + visibleLength(value) <= this.modes.stderr.width;
    if (fits) {
      this.write(`${indent}${label.padEnd(LABEL_WIDTH)}${value}`);
    } else {
      this.write(`${indent}${label}`);
      this.write(`${indent}  ${value}`);
    }
  }

  // The one primary completed result, such as `✓ Added    ia`.
  success(verb: string, value: string) {
    if (!this.ui.rich) {
      this.write(`${verb} ${value}`);
      return;
    }
    const glyph = this.ui.success(this.ui.glyphs.success);
    this.write(`${glyph} ${this.ui.bold(verb.padEnd(LABEL_WIDTH))}${value}`);
  }

  warn(warning: Warning) {
    this.warnings.push(warning);
    if (this.json) return;
    const glyph = this.ui.warning(this.ui.glyphs.warning);
    this.write(`${glyph} ${warning.message}`);
  }

  next(step: NextStep) {
    this.suggest(step.benefit, formatCommand(this.commandName, step.argv));
  }

  // A complete command on its own line, led by what it is for.
  suggest(benefit: string, command: string) {
    this.write(`${this.indent()}${benefit}:`);
    this.write(`${this.indent()}  ${this.ui.command(command)}`);
  }

  // A detail view on stdout: aligned label/value rows, unstyled.
  detail(rows: Array<[label: string, value: string]>) {
    const indent = this.modes.stdout.rich ? " ".repeat(GUTTER) : "";
    for (const [label, value] of rows) {
      this.print(`${indent}${label.padEnd(LABEL_WIDTH)}${value}`);
    }
  }

  // --- errors -------------------------------------------------------------

  error(error: CliError) {
    if (this.json) {
      this.runtime.stderr.write(`${JSON.stringify(errorDocument(error, this.commandName, this.warnings))}\n`);
      return;
    }
    this.pendingBlank = this.wroteTranscript;
    const glyph = this.ui.error(this.ui.glyphs.error);
    this.write(`${glyph} ${error.message}`);
    for (const [label, value] of error.options.rows ?? []) this.row(label, value);
    for (const issue of error.options.issues ?? []) this.text(`${issue.field}: ${issue.message}`);
    for (const step of error.options.next ?? []) {
      this.blank();
      this.next(step);
    }
  }
}

export function errorDocument(error: CliError, commandName: string, warnings: Warning[] = []) {
  const { options } = error;
  const data = {
    ...(options.data ?? {}),
    ...(options.issues ? { issues: options.issues } : {}),
  };
  return {
    status: error.status,
    reason: error.reason,
    message: error.message,
    ...(options.next && options.next.length > 0
      ? {
          next: options.next.map((step) => ({
            command: formatCommand(commandName, step.argv),
            argv: [commandName, ...step.argv],
            ...(step.when ? { when: step.when } : {}),
          })),
        }
      : {}),
    ...(Object.keys(data).length > 0 ? { data } : {}),
    ...(options.userActionRequired ? { userActionRequired: true } : {}),
    ...(options.retryable ? { retryable: true } : {}),
    ...(options.retryAfter !== undefined ? { retryAfter: options.retryAfter } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
