export const MAX_CHAT_MARKDOWN_LENGTH = 12_000;
export const MAX_CHAT_PLAIN_TEXT_LENGTH = 4_000;

const INLINE_MARKDOWN_IMAGE = /!\[([^\]]*)\]\s*(?:\([^)]*\)|\[[^\]]*\])/g;
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
    if (parsed.protocol === "user:" && parsed.hostname) {
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
  if (plainText.length > MAX_CHAT_PLAIN_TEXT_LENGTH) {
    return `Keep the message under ${MAX_CHAT_PLAIN_TEXT_LENGTH.toLocaleString()} characters.`;
  }
  if (markdown.length > MAX_CHAT_MARKDOWN_LENGTH) {
    return `Formatting makes this message too large. Keep it under ${MAX_CHAT_MARKDOWN_LENGTH.toLocaleString()} Markdown characters.`;
  }
  return null;
}
