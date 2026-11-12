import { usageError } from "../core/errors";
import { sanitizeRemoteText } from "../core/theme";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

// Local date and time without seconds: 2026-11-08 13:12.
export function localTimestamp(input: number | string) {
  const date = new Date(input);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** How a person is named here: preferred name when one is set. */
export function personName(
  person:
    | {
        firstName: string;
        lastName: string;
        preferredName?: string | null;
      }
    | null
    | undefined,
) {
  if (!person) return null;
  const name = person.preferredName
    ? `${person.preferredName} ${person.lastName}`
    : `${person.firstName} ${person.lastName}`;
  return sanitizeRemoteText(name);
}

// Local date only: 2026-11-08.
export function localDate(input: number | string) {
  return localTimestamp(input).slice(0, 10);
}

/** The school day key for the local calendar: YYYY-MM-DD. */
export function todayDateKey() {
  return localDate(Date.now());
}

/**
 * Dates accept YYYY-MM-DD, "today", or "tomorrow". The backend rejects
 * anything else, so the message names the accepted forms up front.
 */
export function parseDateInput(input: string): string {
  if (input === "today") return todayDateKey();
  if (input === "tomorrow") return localDate(Date.now() + 24 * 60 * 60 * 1000);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) {
    throw usageError(
      "invalid_date",
      `Dates use YYYY-MM-DD, not ${JSON.stringify(input.slice(0, 40))}.`,
    );
  }
  const parsed = new Date(`${input}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw usageError("invalid_date", `${input} isn't a real calendar date.`);
  }
  return input;
}

/** One line of remote text for a list cell: sanitized, flattened, bounded. */
export function preview(text: string, max = 72) {
  const flat = sanitizeRemoteText(text).replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1)}…`;
}
