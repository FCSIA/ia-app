'use client';

import { Fragment, type ReactNode } from 'react';
import type { Value } from 'platejs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { extractChatGifLinks, hideChatGifLinks } from '~/apps/shared/chat/gifs';
import {
  allowedMessageHref,
  isRichTextLeaf,
  normalizeClubChannelMessageBody,
  serializeClubChannelMessageMarkdown,
  serializeClubChannelMessagePlainText,
  type ClubChannelMessageRichBody,
  type RichTextLeaf,
  type RichTextNode,
} from './mention-serialize';

export {
  EMPTY_CLUB_CHANNEL_MESSAGE_VALUE,
  createEmptyClubChannelMessageValue,
  deserializeClubChannelMessageBody,
  normalizeClubChannelMessageBody,
  serializeClubChannelMessageMarkdown,
  serializeClubChannelMessagePlainText,
  type ClubChannelMessageRichBody,
} from './mention-serialize';

type MentionBodyProps = {
  body: string;
  bodyMarkdown?: string | null;
  bodyRich?: ClubChannelMessageRichBody | null;
  className?: string;
};

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

function messageUrlTransform(url: string) {
  return allowedMessageHref(url.replace(/(?:\\|%5c)([_*~])/gi, '$1')) ?? '';
}

export function MentionBody({ body, bodyMarkdown, bodyRich, className }: MentionBodyProps) {
  const source = bodyMarkdown || body;
  if (extractChatGifLinks(source).length) {
    bodyMarkdown = hideChatGifLinks(bodyMarkdown || serializeClubChannelMessageMarkdown(
      normalizeClubChannelMessageBody(bodyRich, body) as Value,
    ), source);
    if (!bodyMarkdown.trim()) return null;
  }
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
                <a
                  href={safeHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="relative z-10 -mx-0.5 rounded-sm px-0.5 py-1 touch-manipulation outline-none transition-colors hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                >
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
