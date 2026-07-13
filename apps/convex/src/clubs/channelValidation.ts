import { ConvexError } from "convex/values";
import type { ClubChannelPollOption } from "../validators";

export const MAX_CHANNEL_MESSAGE_BODY_CHARACTERS = 4_000;
export const MAX_CHANNEL_MESSAGE_MARKDOWN_CHARACTERS = 12_000;
export const MAX_CHANNEL_MESSAGE_RICH_CHARACTERS = 24_000;
export const MAX_CHANNEL_MESSAGE_ATTACHMENTS = 5;
export const MAX_CHANNEL_POLL_QUESTION_CHARACTERS = 240;
export const MAX_CHANNEL_POLL_OPTIONS = 6;
export const MAX_CHANNEL_POLL_OPTION_LABEL_CHARACTERS = 120;
export const MAX_CHANNEL_POLL_OPTION_ID_CHARACTERS = 64;

const MAX_LEGACY_ATTACHMENT_FILE_NAME_CHARACTERS = 160;
const MAX_LEGACY_ATTACHMENT_URL_CHARACTERS = 2_048;
const MAX_LEGACY_ATTACHMENT_MIME_TYPE_CHARACTERS = 160;
const MAX_LEGACY_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const POLL_OPTION_ID = /^[A-Za-z0-9_-]+$/;

type LegacyAttachmentInput = {
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  size?: number;
};

function characterCount(value: string) {
  return Array.from(value).length;
}

function assertCharacterLimit(value: string, max: number, label: string) {
  if (characterCount(value) > max) {
    throw new ConvexError(`${label} is too long`);
  }
}

export function assertChannelMessageBodyBounds(
  body: string,
  bodyMarkdown?: string,
  bodyRich?: unknown,
) {
  assertCharacterLimit(body, MAX_CHANNEL_MESSAGE_BODY_CHARACTERS, "Message");
  if (bodyMarkdown) {
    assertCharacterLimit(
      bodyMarkdown,
      MAX_CHANNEL_MESSAGE_MARKDOWN_CHARACTERS,
      "Message formatting",
    );
  }
  if (bodyRich !== undefined && bodyRich !== null) {
    const serialized = JSON.stringify(bodyRich);
    assertCharacterLimit(
      serialized,
      MAX_CHANNEL_MESSAGE_RICH_CHARACTERS,
      "Legacy message formatting",
    );
  }
}

export function normalizeChannelPoll(
  question?: string,
  options?: ClubChannelPollOption[],
) {
  const trimmedQuestion = question?.trim();
  const suppliedOptions = options ?? [];
  if (!trimmedQuestion && suppliedOptions.length === 0) return null;
  if (!trimmedQuestion) throw new ConvexError("Poll question is required");
  assertCharacterLimit(
    trimmedQuestion,
    MAX_CHANNEL_POLL_QUESTION_CHARACTERS,
    "Poll question",
  );
  if (
    suppliedOptions.length < 2 ||
    suppliedOptions.length > MAX_CHANNEL_POLL_OPTIONS
  ) {
    throw new ConvexError("Polls must have between 2 and 6 choices");
  }

  const normalized = suppliedOptions.map((option) => {
    const id = option.id.trim();
    const label = option.label.trim();
    if (!id || !POLL_OPTION_ID.test(id)) {
      throw new ConvexError("Poll choice identifiers are invalid");
    }
    assertCharacterLimit(
      id,
      MAX_CHANNEL_POLL_OPTION_ID_CHARACTERS,
      "Poll choice identifier",
    );
    if (!label) throw new ConvexError("Poll choices cannot be empty");
    assertCharacterLimit(
      label,
      MAX_CHANNEL_POLL_OPTION_LABEL_CHARACTERS,
      "Poll choice",
    );
    return { id, label };
  });

  const uniqueIds = new Set(normalized.map((option) => option.id));
  const uniqueLabels = new Set(
    normalized.map((option) => option.label.toLowerCase()),
  );
  if (
    uniqueIds.size !== normalized.length ||
    uniqueLabels.size !== normalized.length
  ) {
    throw new ConvexError("Poll choices must be unique");
  }

  return { question: trimmedQuestion, options: normalized };
}

/**
 * Temporary compatibility boundary for the URL-shaped attachment API. The
 * owned-storage replacement validates these fields against Convex storage.
 */
export function normalizeLegacyChannelAttachments(
  attachments?: LegacyAttachmentInput[],
) {
  if (!attachments) return [];
  if (attachments.length > MAX_CHANNEL_MESSAGE_ATTACHMENTS) {
    throw new ConvexError("A message can include at most 5 attachments");
  }

  return attachments.map((attachment) => {
    const fileName = attachment.fileName.trim();
    const fileUrl = attachment.fileUrl.trim();
    const mimeType = attachment.mimeType?.trim().toLowerCase() || undefined;
    if (!fileName || !fileUrl)
      throw new ConvexError("Attachment details are incomplete");
    assertCharacterLimit(
      fileName,
      MAX_LEGACY_ATTACHMENT_FILE_NAME_CHARACTERS,
      "File name",
    );
    assertCharacterLimit(
      fileUrl,
      MAX_LEGACY_ATTACHMENT_URL_CHARACTERS,
      "Attachment URL",
    );
    if (mimeType) {
      assertCharacterLimit(
        mimeType,
        MAX_LEGACY_ATTACHMENT_MIME_TYPE_CHARACTERS,
        "File type",
      );
    }
    if (
      attachment.size !== undefined &&
      (!Number.isFinite(attachment.size) ||
        attachment.size < 0 ||
        attachment.size > MAX_LEGACY_ATTACHMENT_BYTES)
    ) {
      throw new ConvexError("Attachment size is invalid");
    }
    return {
      fileName,
      fileUrl,
      mimeType,
      size: attachment.size,
    };
  });
}
