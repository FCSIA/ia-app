/**
 * Upload and text limits the server enforces. Forms import the same values to
 * stop early instead of failing on submit.
 */

/** Text limits count code points (`Array.from(text).length`), not UTF-16 units. */
export const MAX_ANNOUNCEMENT_TITLE_CHARACTERS = 160;
export const MAX_ANNOUNCEMENT_BODY_CHARACTERS = 10_000;
export const MAX_ANNOUNCEMENT_COMMENT_CHARACTERS = 2_000;
export const MAX_ANNOUNCEMENT_REJECTION_NOTE_CHARACTERS = 500;
export const MAX_ANNOUNCEMENT_EMBEDS = 3;

export const MIN_PASSWORD_LENGTH = 6;

export const MAX_CLUB_ROLE_NAME_LENGTH = 64;

export const MAX_EVENT_TITLE_CHARACTERS = 160;
export const MAX_EVENT_DESCRIPTION_CHARACTERS = 2_000;

/** Images staged for announcements, feedback reports and volunteer proof. */
export const STAGED_IMAGE_MIME_TYPES = [
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const MAX_STAGED_IMAGE_BYTES = 5 * 1024 * 1024;
/** The same list as a sentence fragment. */
export const STAGED_IMAGE_TYPES_LABEL = "PNG, JPEG, GIF, or WebP";
/** The same list as an `<input accept>` value. */
export const STAGED_IMAGE_ACCEPT = STAGED_IMAGE_MIME_TYPES.join(",");

export function isStagedImageType(mimeType: string) {
  return (STAGED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

export const MAX_ANNOUNCEMENT_IMAGES = 3;
export const MAX_ANNOUNCEMENT_IMAGE_BYTES = MAX_STAGED_IMAGE_BYTES;
export const MAX_FEEDBACK_IMAGES = 3;
export const MAX_FEEDBACK_IMAGE_BYTES = MAX_STAGED_IMAGE_BYTES;
export const MAX_VOLUNTEER_PROOF_BYTES = MAX_STAGED_IMAGE_BYTES;

/** Per-user caps sized for ~3,000 users on Convex Free 1 GB file storage (worst case). */
export const MAX_USER_AVATAR_BYTES = 100 * 1024;
export const MAX_USER_BACKGROUND_BYTES = 248 * 1024;

/** Clients compress to these, a margin under the caps, so a re-encode never overshoots. */
export const AVATAR_COMPRESSION_TARGET_BYTES = MAX_USER_AVATAR_BYTES - 10 * 1024;
export const BACKGROUND_COMPRESSION_TARGET_BYTES = MAX_USER_BACKGROUND_BYTES - 28 * 1024;

/** Web clients ping at this interval; the server ages presence out against it. */
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 30_000;
