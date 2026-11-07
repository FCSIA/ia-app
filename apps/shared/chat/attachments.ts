import { isGifAttachment } from "./gifs";

export const MAX_CHANNEL_MESSAGE_ATTACHMENTS = 5;
export const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
/** Counted in code points. */
export const MAX_CHAT_ATTACHMENT_FILE_NAME_CHARACTERS = 160;

type AttachmentKindInput = {
  fileName: string;
  fileUrl?: string;
  mimeType?: string | null;
};

function baseMimeType(mimeType: string) {
  return mimeType.split(";", 1)[0].trim().toLowerCase();
}

/** Images the native viewer renders inline; SVG never is (it can carry script). */
export function isImageAttachment(attachment: AttachmentKindInput) {
  if (isGifAttachment(attachment)) return true;
  if (attachment.mimeType) {
    return (
      attachment.mimeType.toLowerCase().startsWith("image/") &&
      baseMimeType(attachment.mimeType) !== "image/svg+xml"
    );
  }
  const source = `${attachment.fileName} ${attachment.fileUrl}`.toLowerCase();
  return /\.(avif|gif|heic|heif|jpe?g|png|webp)(?:\?|#|\s|$)/.test(source);
}

/**
 * Images the web chat previews inline. Narrower than isImageAttachment (fewer
 * extensions, case-sensitive MIME prefix); the two have not been reconciled.
 */
export function isWebPreviewableImage(mimeType: string | null | undefined, fileName: string) {
  if (mimeType?.toLowerCase() === "image/svg+xml") return false;
  return !!mimeType?.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(fileName);
}

export function isPdfAttachment(attachment: { fileName: string; mimeType?: string | null }) {
  if (attachment.mimeType && baseMimeType(attachment.mimeType) === "application/pdf") {
    return true;
  }
  return /\.pdf(?:\?|#|$)/i.test(attachment.fileName);
}

/** "512 B", "48 KB", "2.4 MB", "12 MB"; null when the size is unknown. */
export function formatAttachmentSize(size?: number) {
  if (!size || size < 1) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** The web chat's own size labels (one decimal in KB and MB); the viewer lists round differently. */
export function formatWebAttachmentSize(size?: number | null) {
  if (!size) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / (1024 * 102.4)) / 10} MB`;
}

/** The channel details sheet's file list: whole KB (at least 1), then one-decimal MB. */
export function formatWebAttachmentListSize(size?: number) {
  if (!size) return null;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
