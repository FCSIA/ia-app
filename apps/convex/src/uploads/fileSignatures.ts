import { ConvexError } from "convex/values";

const textDecoder = new TextDecoder();

export function detectRasterMime(bytes: Uint8Array) {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const head = textDecoder.decode(bytes.slice(0, 12));
  if (head.startsWith("GIF87a") || head.startsWith("GIF89a")) return "image/gif";
  if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function assertSafeStoredFile(blob: Blob, declaredMime: string) {
  const bytes = new Uint8Array(await blob.slice(0, 512).arrayBuffer());
  const prefix = textDecoder.decode(bytes).trimStart().toLowerCase();
  if (prefix.startsWith("<svg") || prefix.startsWith("<!doctype html") || prefix.startsWith("<html") || prefix.startsWith("<script")) {
    throw new ConvexError("This file type is not allowed");
  }
  if (declaredMime.startsWith("image/")) {
    const detected = detectRasterMime(bytes);
    if (!detected || detected !== declaredMime) throw new ConvexError("Image content does not match its file type");
  }
}
