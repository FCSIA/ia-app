import {
  INLINE_MARKDOWN_IMAGE_SOURCE,
  MAX_CHANNEL_MESSAGE_BODY_CHARACTERS,
  MAX_CHANNEL_MESSAGE_MARKDOWN_CHARACTERS,
  MENTION_URL_PROTOCOL,
} from "~/apps/shared/chat/protocol";

const INLINE_MARKDOWN_IMAGE = new RegExp(INLINE_MARKDOWN_IMAGE_SOURCE, "g");
const HTML_IMAGE = /<img\b[^>]*>/gi;

export function sanitizeChatMarkdown(markdown: string) {
  return markdown.replace(INLINE_MARKDOWN_IMAGE, "$1").replace(HTML_IMAGE, "");
}

export function classifyChatLink(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return { kind: "external" as const, url: parsed.toString() };
    }
    if (parsed.protocol === MENTION_URL_PROTOCOL && parsed.hostname) {
      return { kind: "mention" as const, identifier: parsed.hostname };
    }
  } catch {
    // Invalid and relative URLs are intentionally inert in school chat.
  }
  return null;
}

export function normalizeExternalChatLink(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const classified = classifyChatLink(candidate);
  return classified?.kind === "external" ? classified.url : null;
}

export function chatMessageLengthError(plainText: string, markdown: string) {
  if (plainText.length > MAX_CHANNEL_MESSAGE_BODY_CHARACTERS) {
    return `Keep the message under ${MAX_CHANNEL_MESSAGE_BODY_CHARACTERS.toLocaleString()} characters.`;
  }
  if (markdown.length > MAX_CHANNEL_MESSAGE_MARKDOWN_CHARACTERS) {
    return `Formatting makes this message too large. Keep it under ${MAX_CHANNEL_MESSAGE_MARKDOWN_CHARACTERS.toLocaleString()} Markdown characters.`;
  }
  return null;
}
