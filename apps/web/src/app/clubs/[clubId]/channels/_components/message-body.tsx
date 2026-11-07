'use client';

import type { ClubChannelMessage } from '@/components/clubs/types';
import { MentionBody } from './mention-body';
import type { ClubChannelMessageRichBody } from '@/components/chat/mention-serialize';
import { ChatGifLinks } from './chat-gif';

export function richBodyOf(
  message: Pick<ClubChannelMessage, 'bodyRich'>,
): ClubChannelMessageRichBody | null {
  return Array.isArray(message.bodyRich)
    ? (message.bodyRich as ClubChannelMessageRichBody)
    : null;
}

export function MessageBody({ message }: { message: ClubChannelMessage }) {
  return (
    <>
      <MentionBody
        body={message.body}
        bodyMarkdown={message.bodyMarkdown}
        bodyRich={richBodyOf(message)}
        className="max-w-[75ch]"
      />
      <ChatGifLinks text={message.bodyMarkdown || message.body} />
    </>
  );
}
