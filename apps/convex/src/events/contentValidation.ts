import { ConvexError } from "convex/values";
import {
  MAX_EVENT_DESCRIPTION_CHARACTERS,
  MAX_EVENT_TITLE_CHARACTERS,
} from "../../../shared/limits";

function characterCount(value: string) {
  return Array.from(value).length;
}

export function normalizeEventTitle(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new ConvexError("Event title is required");
  if (characterCount(normalized) > MAX_EVENT_TITLE_CHARACTERS) {
    throw new ConvexError(`Event title cannot exceed ${MAX_EVENT_TITLE_CHARACTERS} characters`);
  }
  return normalized;
}

export function normalizeOptionalEventDescription(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (characterCount(normalized) > MAX_EVENT_DESCRIPTION_CHARACTERS) {
    throw new ConvexError(`Event description cannot exceed ${MAX_EVENT_DESCRIPTION_CHARACTERS} characters`);
  }
  return normalized;
}
