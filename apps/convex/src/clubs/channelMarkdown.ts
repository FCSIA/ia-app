const MARKDOWN_LINK = /!?\[([^\]]*)\]\((?:\\.|[^)])*\)/g;
const MARKDOWN_AUTOLINK = /<((?:https?:\/\/)[^>]+)>/g;
const FENCED_CODE = /```[^\n]*\n([\s\S]*?)```/g;
const INLINE_CODE = /`([^`\n]+)`/g;
const INLINE_MARKDOWN_IMAGE = /!\[[^\]]*\]\s*(?:\([^)]*\)|\[[^\]]*\])|<img\b/i;

export function hasInlineMarkdownImage(markdown: string) {
  return INLINE_MARKDOWN_IMAGE.test(markdown);
}

/**
 * Creates the stable plain-text projection used by search, notifications, and
 * clients that cannot render Markdown. The Markdown source remains stored
 * separately, so this deliberately favors readable text over round-tripping.
 */
export function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/\r\n?/g, "\n")
    .replace(FENCED_CODE, "$1")
    .replace(INLINE_CODE, "$1")
    .replace(MARKDOWN_LINK, "$1")
    .replace(MARKDOWN_AUTOLINK, "$1")
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-+*]\s+|\d+[.)]\s+)/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\\([\\`*{}\[\]()#+\-.!_>~|])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizePortableMessageBody(body: string, bodyMarkdown?: string) {
  const markdown = bodyMarkdown?.trim();
  return {
    body: markdown ? markdownToPlainText(markdown) : body.trim(),
    bodyMarkdown: markdown || undefined,
  };
}

export function portableMentionTokens(body: string, bodyMarkdown?: string) {
  const bareTokens = `${body}\n${bodyMarkdown ?? ""}`
    .match(/@[A-Za-z0-9_-]+/g)
    ?.map((token) => token.slice(1)) ?? [];
  const linkedTokens = Array.from(
    bodyMarkdown?.matchAll(/\]\(user:\/\/([A-Za-z0-9_-]+)\)/g) ?? [],
    (match) => match[1],
  );
  return Array.from(new Set([...linkedTokens, ...bareTokens]));
}
