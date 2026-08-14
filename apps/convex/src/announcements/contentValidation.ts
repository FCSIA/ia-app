import { ConvexError } from "convex/values";

export const MAX_ANNOUNCEMENT_TITLE_CHARACTERS = 160;
export const MAX_ANNOUNCEMENT_BODY_CHARACTERS = 10_000;
export const MAX_ANNOUNCEMENT_COMMENT_CHARACTERS = 2_000;
export const MAX_ANNOUNCEMENT_REJECTION_NOTE_CHARACTERS = 500;
export const MAX_ANNOUNCEMENT_EMBEDS = 3;

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

export function normalizeAnnouncementEmbedUrls(value: string[] | undefined) {
  const urls = value ?? [];
  if (urls.length > MAX_ANNOUNCEMENT_EMBEDS) {
    throw new ConvexError(`You can add up to ${MAX_ANNOUNCEMENT_EMBEDS} links`);
  }

  const normalized = urls.map((rawUrl) => {
    const value = rawUrl.trim();
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new ConvexError("Each embedded link must be a valid HTTPS URL");
    }
    if (parsed.protocol !== "https:") {
      throw new ConvexError("Each embedded link must use HTTPS");
    }
    return parsed.toString();
  });

  if (new Set(normalized).size !== normalized.length) {
    throw new ConvexError("An embedded link can only be added once");
  }
  return normalized;
}
