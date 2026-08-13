import { ConvexError } from "convex/values";

export const MAX_ANNOUNCEMENT_TITLE_CHARACTERS = 160;
export const MAX_ANNOUNCEMENT_BODY_CHARACTERS = 10_000;
export const MAX_ANNOUNCEMENT_COMMENT_CHARACTERS = 2_000;
export const MAX_ANNOUNCEMENT_REJECTION_NOTE_CHARACTERS = 500;

function characterCount(value: string) {
  return Array.from(value).length;
}

export function normalizeBoundedText(value: string, label: string, max: number) {
  const normalized = value.trim();
  if (!normalized) throw new ConvexError(`${label} cannot be empty`);
  if (characterCount(normalized) > max) throw new ConvexError(`${label} is too long`);
  return normalized;
}

export function normalizeOptionalBoundedText(
  value: string | undefined,
  label: string,
  max: number,
) {
  if (value === undefined) return undefined;
  return normalizeBoundedText(value, label, max);
}
