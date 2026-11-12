// Error classes set the exit code; `reason` is the stable, machine-readable code.

export type ErrorKind =
  | "usage"
  | "missing_input"
  | "authentication"
  | "permission"
  | "not_found"
  | "conflict"
  | "limit"
  | "rate_limit"
  | "network"
  | "platform"
  | "unknown_outcome"
  | "partial"
  | "config"
  | "internal"
  | "canceled";

const EXIT_CODES: Record<ErrorKind, number> = {
  usage: 2,
  missing_input: 2,
  authentication: 1,
  permission: 1,
  not_found: 1,
  conflict: 1,
  limit: 1,
  rate_limit: 1,
  network: 1,
  platform: 1,
  unknown_outcome: 1,
  partial: 1,
  config: 1,
  internal: 1,
  canceled: 130,
};

export interface NextStep {
  // Human lead-in, such as "Pick another name". Rendered with a trailing colon.
  benefit: string;
  // Arguments after the command name; the writer prefixes the invoked name.
  argv: string[];
  // JSON-only guidance, such as "Only after a human approves: ...".
  when?: string;
}

export interface Issue {
  field: string;
  reason: string;
  message: string;
}

export interface CliErrorOptions {
  status?: "error" | "action_required";
  next?: NextStep[];
  data?: Record<string, unknown>;
  issues?: Issue[];
  userActionRequired?: boolean;
  retryable?: boolean;
  retryAfter?: number;
  // Aligned detail rows shown under the headline in human output.
  rows?: Array<[label: string, value: string]>;
}

export class CliError extends Error {
  readonly kind: ErrorKind;
  readonly reason: string;
  readonly options: CliErrorOptions;

  constructor(kind: ErrorKind, reason: string, message: string, options: CliErrorOptions = {}) {
    super(message);
    this.name = "CliError";
    this.kind = kind;
    this.reason = reason;
    this.options = options;
  }

  get exitCode() {
    return EXIT_CODES[this.kind];
  }

  get status() {
    if (this.options.status) return this.options.status;
    return this.kind === "missing_input" ? "action_required" : "error";
  }
}

export function usageError(reason: string, message: string, options?: CliErrorOptions) {
  return new CliError("usage", reason, message, options);
}

export function internalError(commandPath: string, cause: unknown, rerunArgv: string[]) {
  return new CliError(
    "internal",
    "internal_error",
    `Unexpected error in ${commandPath}. This is a bug in the CLI.`,
    {
      data: { cause: cause instanceof Error ? cause.message : String(cause) },
      next: [
        {
          benefit: "Run it again with diagnostics, review the output, then report it",
          argv: [...rerunArgv.filter((argument) => argument !== "--debug"), "--debug"],
        },
      ],
    },
  );
}
