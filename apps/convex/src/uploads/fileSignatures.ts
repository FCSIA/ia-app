import { ConvexError } from "convex/values";

const textDecoder = new TextDecoder();
const strictTextDecoder = new TextDecoder("utf-8", { fatal: true });

const RASTER_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ZIP_MIME_TYPES = new Set([
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const OLE_MIME_TYPES = new Set([
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
]);
const TEXT_MIME_TYPES = new Set(["text/plain", "text/csv"]);

export function normalizeStoredFileMime(mime: string) {
  return mime.split(";", 1)[0].trim().toLowerCase();
}

export function isSupportedStoredFileMime(mime: string) {
  const normalized = normalizeStoredFileMime(mime);
  return (
    RASTER_MIME_TYPES.has(normalized) ||
    normalized === "application/pdf" ||
    ZIP_MIME_TYPES.has(normalized) ||
    OLE_MIME_TYPES.has(normalized) ||
    TEXT_MIME_TYPES.has(normalized)
  );
}

export function detectRasterMime(bytes: Uint8Array) {
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    )
  )
    return "image/png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image/jpeg";
  const head = textDecoder.decode(bytes.slice(0, 12));
  if (head.startsWith("GIF87a") || head.startsWith("GIF89a"))
    return "image/gif";
  if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP")
    return "image/webp";
  return null;
}

function startsWithBytes(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function hasActiveMarkup(bytes: Uint8Array) {
  const prefix = textDecoder.decode(bytes).toLowerCase();
  return /<\s*(?:!doctype\s+html\b|html\b|head\b|body\b|script\b|svg\b)/i.test(
    prefix,
  );
}

function isValidUtf8Text(bytes: Uint8Array) {
  if (
    bytes.some(
      (value) => value < 0x20 && value !== 0x09 && value !== 0x0a && value !== 0x0d,
    )
  )
    return false;
  try {
    strictTextDecoder.decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export function assertSafeStoredFile(
  contents: ArrayBuffer,
  declaredMime: string,
) {
  const mime = normalizeStoredFileMime(declaredMime);
  const bytes = new Uint8Array(
    contents,
    0,
    Math.min(contents.byteLength, 4096),
  );
  if (hasActiveMarkup(bytes)) {
    throw new ConvexError("This file type is not allowed");
  }
  if (!isSupportedStoredFileMime(mime)) {
    throw new ConvexError("This file type is not supported");
  }
  if (RASTER_MIME_TYPES.has(mime)) {
    const detected = detectRasterMime(bytes);
    if (!detected || detected !== mime) {
      throw new ConvexError("Image content does not match its file type");
    }
    return;
  }
  if (
    mime === "application/pdf" &&
    !startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])
  ) {
    throw new ConvexError("PDF content does not match its file type");
  }
  if (
    ZIP_MIME_TYPES.has(mime) &&
    ![
      [0x50, 0x4b, 0x03, 0x04],
      [0x50, 0x4b, 0x05, 0x06],
      [0x50, 0x4b, 0x07, 0x08],
    ].some((signature) => startsWithBytes(bytes, signature))
  ) {
    throw new ConvexError("Archive content does not match its file type");
  }
  if (
    OLE_MIME_TYPES.has(mime) &&
    !startsWithBytes(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  ) {
    throw new ConvexError("Document content does not match its file type");
  }
  if (TEXT_MIME_TYPES.has(mime) && !isValidUtf8Text(bytes)) {
    throw new ConvexError("Text content does not match its file type");
  }
}
