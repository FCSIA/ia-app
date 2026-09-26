'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useConvex, useMutation } from '@/lib/convex-react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { shareUrl } from '@/lib/share';
import { chunkWhiteboardElements } from './whiteboard-sync';

export type WhiteboardSummary = {
  _id: Id<'clubWhiteboards'>;
  title: string;
};

function convexErrorMessage(error: unknown) {
  const data = (error as { data?: unknown } | null)?.data;
  return typeof data === 'string' ? data : undefined;
}

/** The open board lives in the URL so links, back, and refresh all work. */
export function useWhiteboardRoute() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const boardId = (searchParams?.get('board') ?? null) as Id<'clubWhiteboards'> | null;

  const hrefFor = useCallback(
    (target: Id<'clubWhiteboards'> | null) => {
      const next = new URLSearchParams(searchParams?.toString());
      next.set('view', 'whiteboard');
      if (target) next.set('board', target);
      else next.delete('board');
      return `${pathname}?${next.toString()}`;
    },
    [pathname, searchParams],
  );

  return {
    boardId,
    hrefFor,
    openBoard: useCallback(
      (target: Id<'clubWhiteboards'>) => router.push(hrefFor(target), { scroll: false }),
      [hrefFor, router],
    ),
    closeBoard: useCallback(() => router.push(hrefFor(null), { scroll: false }), [hrefFor, router]),
  };
}

export function useWhiteboardActions(channelId: Id<'clubChannels'>) {
  const convex = useConvex();
  const { toast } = useToast();
  const { hrefFor, openBoard } = useWhiteboardRoute();
  const createBoard = useMutation(api.clubs.whiteboards.create);
  const renameBoard = useMutation(api.clubs.whiteboards.rename);
  const setArchived = useMutation(api.clubs.whiteboards.setArchived);
  const saveElements = useMutation(api.clubs.whiteboards.saveElements);

  const fail = useCallback(
    (title: string, error: unknown) =>
      toast({ title, description: convexErrorMessage(error), variant: 'destructive' }),
    [toast],
  );

  const create = useCallback(async () => {
    try {
      openBoard(await createBoard({ channelId }));
    } catch (error) {
      fail('Could not create a whiteboard', error);
    }
  }, [channelId, createBoard, fail, openBoard]);

  const rename = useCallback(
    async (board: WhiteboardSummary, title: string) => {
      try {
        await renameBoard({ boardId: board._id, title });
      } catch (error) {
        fail('Could not rename the whiteboard', error);
      }
    },
    [fail, renameBoard],
  );

  /**
   * Copies the board's current drawing into a new board. The open canvas can
   * supply its exact elements; otherwise the latest stored version is used.
   */
  const duplicate = useCallback(
    async (board: WhiteboardSummary, currentElements?: string[]) => {
      try {
        let elements = currentElements;
        if (!elements) {
          const snapshot = await convex.query(api.clubs.whiteboards.getVersion, {
            boardId: board._id,
            atSeq: Number.MAX_SAFE_INTEGER,
          });
          if (!snapshot) throw new Error('Whiteboard not found');
          elements = snapshot.elements;
        }
        const copyId = await createBoard({
          channelId,
          title: `${board.title} (copy)`,
          duplicatedFromBoardId: board._id,
        });
        await Promise.all(
          chunkWhiteboardElements(elements).map((chunk) =>
            saveElements({ boardId: copyId, elements: chunk }),
          ),
        );
        toast({ title: `Duplicated “${board.title}”` });
        openBoard(copyId);
      } catch (error) {
        fail('Could not duplicate the whiteboard', error);
      }
    },
    [channelId, convex, createBoard, fail, openBoard, saveElements, toast],
  );

  const archive = useCallback(
    async (board: WhiteboardSummary, archived: boolean) => {
      try {
        await setArchived({ boardId: board._id, archived });
        toast({
          title: archived ? `Archived “${board.title}”` : `Restored “${board.title}”`,
          description: archived ? 'It stays in Archived until someone restores it.' : undefined,
          // Long enough to reach Undo; the default is tuned for plain notices.
          duration: archived ? 8000 : undefined,
          action: archived ? (
            <ToastAction
              altText="Undo archive"
              onClick={() => void setArchived({ boardId: board._id, archived: false })}
            >
              Undo
            </ToastAction>
          ) : undefined,
        });
      } catch (error) {
        fail(archived ? 'Could not archive the whiteboard' : 'Could not restore the whiteboard', error);
      }
    },
    [fail, setArchived, toast],
  );

  const share = useCallback(
    async (board: WhiteboardSummary) => {
      try {
        const result = await shareUrl({
          title: board.title,
          url: `${window.location.origin}${hrefFor(board._id)}`,
        });
        if (result === 'copied') {
          toast({ title: 'Link copied', description: 'Anyone in this channel can open it.' });
        }
      } catch {
        fail('Could not share the link', null);
      }
    },
    [fail, hrefFor, toast],
  );

  return useMemo(
    () => ({ create, rename, duplicate, archive, share }),
    [archive, create, duplicate, rename, share],
  );
}
