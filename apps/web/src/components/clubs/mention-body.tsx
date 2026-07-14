'use client';

import { Fragment, type ReactNode } from 'react';
import type { Value } from 'platejs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

export type ClubChannelMessageRichBody = Value;

type MentionBodyProps = {
  body: string;
  bodyMarkdown?: string | null;
  bodyRich?: ClubChannelMessageRichBody | null;
  className?: string;
};

type RichTextLeaf = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  [key: string]: unknown;
};

type RichTextElement = {
  type?: string;
  value?: string;
  children?: RichTextNode[];
  [key: string]: unknown;
};

type RichTextNode = RichTextLeaf | RichTextElement;

export const EMPTY_CLUB_CHANNEL_MESSAGE_VALUE: Value = [
  { type: 'p', children: [{ text: '' }] },
];

export function createEmptyClubChannelMessageValue(): Value {
  return [{ type: 'p', children: [{ text: '' }] }];
}

function isRichTextLeaf(node: RichTextNode): node is RichTextLeaf {
  return typeof (node as RichTextLeaf).text === 'string';
}

function serializeNodePlainText(node: RichTextNode): string {
  if (isRichTextLeaf(node)) {
    return node.text;
  }

  if (node.type === 'mention' && typeof node.value === 'string') {
    return `@${node.value}`;
  }

  return (node.children ?? []).map(serializeNodePlainText).join('');
}

export function serializeClubChannelMessagePlainText(value: Value): string {
  return (value as RichTextNode[]).map(serializeNodePlainText).join('\n');
}

function escapeMarkdownText(text: string) {
  return text.replace(/([\\`*_[\]~])/g, '\\$1');
}

function serializeNodeMarkdown(node: RichTextNode): string {
  if (isRichTextLeaf(node)) {
    let content = escapeMarkdownText(node.text);
    if (!content) return content;
    if (node.bold) content = `**${content}**`;
    if (node.italic) content = `_${content}_`;
    if (node.underline) content = `__${content}__`;
    return content;
  }

  if (node.type === 'mention' && typeof node.value === 'string') {
    return `[@${node.value}](user://${node.value})`;
  }

  const content = (node.children ?? []).map(serializeNodeMarkdown).join('');
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

function renderLeafContent(leaf: RichTextLeaf, keyBase: string) {
  return leaf.text.split(/(@[A-Za-z0-9_-]+)/g).map((part, index) => {
    if (!part) return null;

    const className = cn(
      leaf.bold && 'font-semibold',
      leaf.italic && 'italic',
      leaf.underline && 'underline decoration-[0.08em] underline-offset-[0.18em]',
      /^@[A-Za-z0-9_-]+$/.test(part) &&
        'rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary',
    );

    if (!className) {
      return <Fragment key={`${keyBase}-${index}`}>{part}</Fragment>;
    }

    return (
      <span key={`${keyBase}-${index}`} className={className}>
        {part}
      </span>
    );
  });
}

function renderInlineNode(node: RichTextNode, keyBase: string): ReactNode {
  if (isRichTextLeaf(node)) {
    return renderLeafContent(node, keyBase);
  }

  if (node.type === 'mention' && typeof node.value === 'string') {
    return (
      <span
        key={keyBase}
        className="rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary"
      >
        @{node.value}
      </span>
    );
  }

  return (node.children ?? []).map((child, index) =>
    renderInlineNode(child, `${keyBase}-${index}`),
  );
}

function renderBlockNode(node: RichTextNode, index: number) {
  if (isRichTextLeaf(node)) {
    return (
      <p key={`leaf-${index}`} className="whitespace-pre-wrap">
        {renderLeafContent(node, `leaf-${index}`)}
      </p>
    );
  }

  const content = (node.children ?? []).map((child, childIndex) =>
    renderInlineNode(child, `node-${index}-${childIndex}`),
  );
  const isEmpty = content.every((child) => child === null);

  if (node.type === 'blockquote') {
    return (
      <blockquote
        key={`blockquote-${index}`}
        className="border-l-2 border-primary/30 pl-4 text-muted-foreground"
      >
        {isEmpty ? <br /> : content}
      </blockquote>
    );
  }

  return (
    <p key={`paragraph-${index}`} className="whitespace-pre-wrap">
      {isEmpty ? <br /> : content}
    </p>
  );
}

function allowedMessageHref(href?: string) {
  if (!href) return null;
  try {
    const url = new URL(href);
    return ['http:', 'https:', 'user:'].includes(url.protocol) ? href : null;
  } catch {
    return null;
  }
}

function messageUrlTransform(url: string) {
  return allowedMessageHref(url) ?? '';
}

export function MentionBody({ body, bodyMarkdown, bodyRich, className }: MentionBodyProps) {
  if (bodyMarkdown?.trim()) {
    return (
      <div
        className={cn(
          'typeset typeset-chat max-w-none',
          className,
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          urlTransform={messageUrlTransform}
          components={{
            img: () => null,
            a: ({ href, children }) => {
              const safeHref = allowedMessageHref(href);
              if (!safeHref || safeHref.startsWith('user://')) {
                return (
                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                    {children}
                  </span>
                );
              }
              return (
                <a href={safeHref} target="_blank" rel="noreferrer noopener">
                  {children}
                </a>
              );
            },
            strong: ({ node, children }) => {
              const start = node?.position?.start.offset;
              const marker = start === undefined ? null : bodyMarkdown.slice(start, start + 2);
              return marker === '__' ? <u>{children}</u> : <strong>{children}</strong>;
            },
          }}
        >
          {bodyMarkdown}
        </ReactMarkdown>
      </div>
    );
  }

  const value = normalizeClubChannelMessageBody(bodyRich, body) as RichTextNode[];
  const hasContent = serializeClubChannelMessagePlainText(value as Value).trim().length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <div className={cn('typeset typeset-chat text-foreground', className)}>
      {value.map((node, index) => renderBlockNode(node, index))}
    </div>
  );
}
