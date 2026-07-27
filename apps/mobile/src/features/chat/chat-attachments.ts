export const MAX_CHAT_ATTACHMENTS = 5;
export const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const MAX_CHAT_ATTACHMENT_FILE_NAME_CHARACTERS = 160;
const BLOCKED_CHAT_ATTACHMENT_TYPES = new Set([
  "application/javascript",
  "image/svg+xml",
  "text/html",
  "text/javascript",
]);
const BLOCKED_CHAT_ATTACHMENT_EXTENSIONS = new Set([
  ".htm",
  ".html",
  ".js",
  ".mjs",
  ".svg",
]);

export type PickedChatAttachmentMetadata = {
  fileName: string;
  mimeType?: string | null;
  size: number;
};

export function validatePickedChatAttachment(
  attachment: PickedChatAttachmentMetadata,
) {
  const fileName = attachment.fileName.trim();
  if (!fileName || /[\\/\u0000-\u001F\u007F]/.test(fileName)) {
    return "This file has an invalid name.";
  }
  if (Array.from(fileName).length > MAX_CHAT_ATTACHMENT_FILE_NAME_CHARACTERS) {
    return "Keep file names under 160 characters.";
  }
  if (!Number.isFinite(attachment.size) || attachment.size < 0) {
    return "The file size could not be read.";
  }
  if (attachment.size > MAX_CHAT_ATTACHMENT_BYTES) {
    return "Choose a file smaller than 10 MB.";
  }

  const mimeType = normalizedMimeType(attachment.mimeType);
  const extension = fileExtension(fileName);
  if (
    BLOCKED_CHAT_ATTACHMENT_TYPES.has(mimeType) ||
    BLOCKED_CHAT_ATTACHMENT_EXTENSIONS.has(extension)
  ) {
    return "This file type is not allowed in school chat.";
  }
  return null;
}

export function normalizedMimeType(mimeType?: string | null) {
  return (mimeType || "application/octet-stream")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
}

export function parseConvexStorageId(body: string) {
  try {
    const parsed = JSON.parse(body) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "storageId" in parsed &&
      typeof parsed.storageId === "string" &&
      parsed.storageId
    ) {
      return parsed.storageId;
    }
  } catch {
    // The upload endpoint did not return its expected JSON payload.
  }
  return null;
}

export function safeRemoteAttachmentUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function attachmentCacheFileName(
  fileName: string,
  attachmentId: string,
) {
  const extension = fileExtension(fileName);
  const safeExtension = BLOCKED_CHAT_ATTACHMENT_EXTENSIONS.has(extension)
    ? ""
    : extension;
  const safeId = attachmentId.replace(/[^A-Za-z0-9_-]/g, "").slice(-40);
  return `ia-chat-${safeId || "attachment"}${safeExtension}`;
}

function fileExtension(fileName: string) {
  return fileName.match(/\.[A-Za-z0-9]{1,12}$/)?.[0].toLowerCase() ?? "";
}
