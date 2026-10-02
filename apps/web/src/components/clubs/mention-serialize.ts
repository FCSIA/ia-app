import type { Value } from 'platejs';

// Pure conversion between the chat composer's rich value and the plain text
// and Markdown stored with each message. Kept free of React so it can be
// tested and shared.

export type ClubChannelMessageRichBody = Value;

export type RichTextLeaf = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  [key: string]: unknown;
};

export type RichTextElement = {
  type?: string;
  key?: string;
  value?: string;
  children?: RichTextNode[];
  [key: string]: unknown;
};

export type RichTextNode = RichTextLeaf | RichTextElement;

export const EMPTY_CLUB_CHANNEL_MESSAGE_VALUE: Value = [
  { type: 'p', children: [{ text: '' }] },
];

export function createEmptyClubChannelMessageValue(): Value {
  return [{ type: 'p', children: [{ text: '' }] }];
}

export function isRichTextLeaf(node: RichTextNode): node is RichTextLeaf {
  return typeof (node as RichTextLeaf).text === 'string';
}

function isMentionNode(node: RichTextNode) {
  return !isRichTextLeaf(node) && node.type === 'mention' && typeof node.value === 'string';
}

const WORD_CHARACTER = /[\p{L}\p{N}]/u;

/**
 * Joins inline nodes, adding a space where a mention would otherwise run into
 * a word: typing straight after a picked mention gave plain text such as
 * "@allWe have…" in notifications and previews.
 */
function joinInline(children: RichTextNode[], serialize: (node: RichTextNode) => string) {
  let joined = '';
  let lastPlain = '';
  let lastWasMention = false;
  for (const child of children) {
    const part = serialize(child);
    if (!part) continue;
    const plain = serializeNodePlainText(child);
    const mention = isMentionNode(child);
    const touchesWord =
      (lastWasMention && WORD_CHARACTER.test(plain.charAt(0))) ||
      (mention && WORD_CHARACTER.test(lastPlain.charAt(lastPlain.length - 1)));
    if (joined && touchesWord) joined += ' ';
    joined += part;
    lastPlain = plain;
    lastWasMention = mention;
  }
  return joined;
}

function serializeNodePlainText(node: RichTextNode): string {
  if (isRichTextLeaf(node)) {
    return node.text;
  }

  if (node.type === 'mention' && typeof node.value === 'string') {
    return `@${node.value}`;
  }

  return joinInline(node.children ?? [], serializeNodePlainText);
}

export function serializeClubChannelMessagePlainText(value: Value): string {
  return (value as RichTextNode[]).map(serializeNodePlainText).join('\n');
}

function escapeMarkdownText(text: string) {
  return text.replace(/([\\`*_[\]~])/g, '\\$1');
}

const inlineMarkdownLinkPattern =
  /\[([^\]\n]+)\]\((https?:\/\/(?:[^\s()]|\([^\s()]*\))+)\)/gi;

function serializeMarkdownText(text: string) {
  let markdown = '';
  let cursor = 0;

  for (const match of text.matchAll(inlineMarkdownLinkPattern)) {
    const index = match.index;
    if (index === undefined) continue;

    const [source, label, href] = match;
    markdown += escapeMarkdownText(text.slice(cursor, index));

    const safeHref = allowedMessageHref(href);
    markdown += safeHref
      ? `[${escapeMarkdownText(label)}](${safeHref})`
      : escapeMarkdownText(source);
    cursor = index + source.length;
  }

  return markdown + escapeMarkdownText(text.slice(cursor));
}

function serializeNodeMarkdown(node: RichTextNode): string {
  if (isRichTextLeaf(node)) {
    let content = serializeMarkdownText(node.text);
    if (!content) return content;
    if (node.bold) content = `**${content}**`;
    if (node.italic) content = `_${content}_`;
    if (node.underline) content = `__${content}__`;
    return content;
  }

  if (node.type === 'mention' && typeof node.value === 'string') {
    const token = typeof node.key === 'string' ? node.key : node.value;
    return `[@${node.value}](user://${token})`;
  }

  const content = joinInline(node.children ?? [], serializeNodeMarkdown);
  if (node.type === 'blockquote') {
    return content
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
  }
  return content;
}

export function serializeClubChannelMessageMarkdown(value: Value): string {
  return (value as RichTextNode[]).map(serializeNodeMarkdown).join('\n\n').trim();
}

export function deserializeClubChannelMessageBody(body: string): Value {
  if (!body) {
    return createEmptyClubChannelMessageValue();
  }

  return body.split('\n').map((line) => ({
    type: 'p',
    children: [{ text: line }],
  }));
}

export function normalizeClubChannelMessageBody(
  bodyRich?: ClubChannelMessageRichBody | null,
  body = '',
): Value {
  if (Array.isArray(bodyRich) && bodyRich.length > 0) {
    return bodyRich as Value;
  }

  return deserializeClubChannelMessageBody(body);
}

export function allowedMessageHref(href?: string) {
  if (!href) return null;
  try {
    const url = new URL(href);
    return ['http:', 'https:', 'user:'].includes(url.protocol) ? href : null;
  } catch {
    return null;
  }
}
