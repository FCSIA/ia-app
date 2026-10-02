'use client';

import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { useWhiteboardRoute } from './use-whiteboard-actions';
import { WhiteboardBoardView } from './whiteboard-board-view';
import { WhiteboardList } from './whiteboard-list';

/** A channel's whiteboards: the board list, or one open board from the URL. */
export function ChannelWhiteboard({
  channelId,
  channelName,
}: {
  channelId: Id<'clubChannels'>;
  channelName: string;
}) {
  const { boardId } = useWhiteboardRoute();
  return boardId ? (
    <WhiteboardBoardView key={boardId} channelId={channelId} boardId={boardId} />
  ) : (
    <WhiteboardList channelId={channelId} channelName={channelName} />
  );
}
