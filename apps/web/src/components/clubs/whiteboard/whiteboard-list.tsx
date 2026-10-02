'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  Copy,
  Link2,
  MoreHorizontal,
  PenLine,
  Plus,
  PencilRuler,
  Search,
} from 'lucide-react';
import { usePaginatedQuery, useQuery } from '@/lib/convex-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardDescription,
  CardGroup,
  CardHeader,
  CardImage,
  CardTitle,
} from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DropdownContent, DropdownMenu, DropdownTrigger } from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { cursorActiveSince } from './whiteboard-sync';
import {
  useWhiteboardActions,
  useWhiteboardRoute,
  type WhiteboardSummary,
} from './use-whiteboard-actions';

type BoardSummary = {
  _id: Id<'clubWhiteboards'>;
  title: string;
  createdAt: number;
  createdByName: string;
  updatedAt: number;
  updatedByName: string | null;
  archivedAt: number | null;
  activeViewerCount: number;
};

/** Show a search field once a channel has more boards than fit at a glance. */
const SEARCH_THRESHOLD = 6;

function useColumns() {
  const ref = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(3);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      setColumns(width < 460 ? 1 : width < 820 ? 2 : 3);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, columns };
}

function activityLine(board: BoardSummary) {
  const when = formatDistanceToNowStrict(board.updatedAt, { addSuffix: true });
  return board.updatedByName ? `Edited ${when} by ${board.updatedByName}` : `Created ${when}`;
}

function BoardThumbnail({ boardId, title }: { boardId: Id<'clubWhiteboards'>; title: string }) {
  const thumbnail = useQuery(api.clubs.whiteboards.getThumbnail, { boardId });
  if (thumbnail) {
    return <CardImage src={thumbnail} alt={`Preview of ${title}`} className="bg-white object-contain" />;
  }
  return (
    <div
      aria-hidden
      className="flex aspect-[16/9] w-full items-center justify-center rounded-[2px] bg-muted/40 text-muted-foreground"
    >
      <PencilRuler className="size-6 opacity-60" />
    </div>
  );
}

function BoardMenu({
  board,
  onRename,
  actions,
}: {
  board: BoardSummary;
  onRename: () => void;
  actions: ReturnType<typeof useWhiteboardActions>;
}) {
  const archived = board.archivedAt !== null;
  const items = archived
    ? [
        { label: 'Restore', icon: ArchiveRestore, onSelect: () => void actions.archive(board, false) },
        { label: 'Duplicate', icon: Copy, onSelect: () => void actions.duplicate(board) },
      ]
    : [
        { label: 'Rename', icon: PenLine, onSelect: onRename },
        { label: 'Duplicate', icon: Copy, onSelect: () => void actions.duplicate(board) },
        { label: 'Share link', icon: Link2, onSelect: () => void actions.share(board) },
        { label: 'Archive', icon: Archive, onSelect: () => void actions.archive(board, true) },
      ];
  return (
    <DropdownMenu>
      <DropdownTrigger
        render={
          <Button type="button" variant="ghost" size="icon-compact" aria-label={`Actions for ${board.title}`}>
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownContent align="end">
        {items.map((item, index) => (
          <MenuItem key={item.label} index={index} icon={item.icon} label={item.label} onSelect={item.onSelect} />
        ))}
      </DropdownContent>
    </DropdownMenu>
  );
}

function RenameDialog({
  board,
  onClose,
  onRename,
}: {
  board: WhiteboardSummary | null;
  onClose: () => void;
  onRename: (board: WhiteboardSummary, title: string) => void;
}) {
  const [title, setTitle] = useState('');
  useEffect(() => {
    if (board) setTitle(board.title);
  }, [board]);
  const submit = () => {
    if (!board) return;
    onRename(board, title);
    onClose();
  };
  return (
    <Dialog open={!!board} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename whiteboard</DialogTitle>
          <DialogDescription className="sr-only">Enter a new name for this whiteboard.</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={title}
          maxLength={80}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
          }}
          aria-label="Whiteboard name"
        />
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={submit}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ARCHIVE_PAGE_SIZE = 20;

/**
 * The archive is unbounded, so it loads only when opened and then a page at a
 * time. The count comes from the server's exact tally, not loaded rows.
 */
function ArchivedBoards({
  channelId,
  count,
  search,
  actions,
  onRename,
}: {
  channelId: Id<'clubChannels'>;
  count: number;
  search: string;
  actions: ReturnType<typeof useWhiteboardActions>;
  onRename: (board: WhiteboardSummary) => void;
}) {
  const [open, setOpen] = useState(false);
  const { openBoard } = useWhiteboardRoute();
  const { results, status, loadMore } = usePaginatedQuery(
    api.clubs.whiteboards.listArchived,
    open ? { channelId } : 'skip',
    { initialNumItems: ARCHIVE_PAGE_SIZE },
  );
  const needle = search.trim().toLowerCase();
  const shown = needle
    ? results.filter((board) => board.title.toLowerCase().includes(needle))
    : results;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="group/archived -ml-2 w-fit">
          <ChevronRight className="size-3.5 transition-transform group-data-[state=open]/archived:rotate-90" />
          Archived ({count})
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {status === 'LoadingFirstPage' ? (
          <div className="flex justify-center py-4">
            <Spinner className="size-4" />
          </div>
        ) : shown.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            {needle ? `No loaded archived whiteboards match “${search}”.` : 'Nothing archived.'}
          </p>
        ) : (
          <CardGroup orientation="inline" className="mt-2" aria-label="Archived whiteboards">
            {shown.map((board) => (
              <Card key={board._id} onClick={() => openBoard(board._id)} label={`Open ${board.title}`}>
                <div className="min-w-0 flex-1 py-2.5">
                  <p className="truncate text-sm font-medium text-foreground">{board.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Archived {formatDistanceToNowStrict(board.archivedAt ?? board.updatedAt, { addSuffix: true })}
                  </p>
                </div>
                <div className="relative z-30 pr-2">
                  <BoardMenu board={board} onRename={() => onRename(board)} actions={actions} />
                </div>
              </Card>
            ))}
          </CardGroup>
        )}
        {status === 'CanLoadMore' || status === 'LoadingMore' ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1"
            loading={status === 'LoadingMore'}
            onClick={() => loadMore(ARCHIVE_PAGE_SIZE)}
          >
            Show more archived ({Math.max(0, count - results.length)} more)
          </Button>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function WhiteboardList({
  channelId,
  channelName,
}: {
  channelId: Id<'clubChannels'>;
  channelName: string;
}) {
  const [activeSince, setActiveSince] = useState(() => cursorActiveSince(Date.now()));
  useEffect(() => {
    const timer = setInterval(() => setActiveSince(cursorActiveSince(Date.now())), 10_000);
    return () => clearInterval(timer);
  }, []);
  const latest = useQuery(api.clubs.whiteboards.listForChannel, { channelId, activeSince });
  // The presence window advances every ten seconds; keep showing the last
  // result while the next one loads instead of flashing the loading state.
  const [shown, setShown] = useState<{ channelId: string; value: typeof latest }>();
  if (latest !== undefined && shown?.value !== latest) {
    setShown({ channelId, value: latest });
  }
  const listing = latest ?? (shown?.channelId === channelId ? shown.value : undefined);
  const actions = useWhiteboardActions(channelId);
  const { openBoard } = useWhiteboardRoute();
  const { ref, columns } = useColumns();
  const [search, setSearch] = useState('');
  const [renaming, setRenaming] = useState<WhiteboardSummary | null>(null);
  const [creating, setCreating] = useState(false);

  const active = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (listing?.boards ?? []).filter(
      (board) => !needle || board.title.toLowerCase().includes(needle),
    );
  }, [listing, search]);

  const create = async () => {
    setCreating(true);
    await actions.create();
    setCreating(false);
  };

  if (listing === undefined) {
    return (
      <div className="flex size-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading whiteboards…
      </div>
    );
  }
  if (listing === null) {
    return (
      <div className="flex size-full items-center justify-center p-6 text-sm text-muted-foreground">
        Whiteboards are unavailable in this channel.
      </div>
    );
  }

  const totalActive = listing.boards.length;
  const atLimit = totalActive >= listing.activeLimit;
  const newButton = (size: 'sm' | 'md') => (
    <Button
      type="button"
      size={size}
      leadingIcon={Plus}
      loading={creating}
      disabled={atLimit}
      onClick={() => void create()}
    >
      New whiteboard
    </Button>
  );

  return (
    <ScrollArea className="size-full">
      <div ref={ref} className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground">Whiteboards</h2>
            {atLimit ? (
              <p className="text-xs text-muted-foreground">
                {listing.activeLimit} board limit reached. Archive one to add another.
              </p>
            ) : null}
          </div>
          {totalActive + listing.archivedCount >= SEARCH_THRESHOLD ? (
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search whiteboards"
                aria-label="Search whiteboards"
                className="pl-8"
              />
            </div>
          ) : null}
          {totalActive > 0 ? newButton('sm') : null}
        </div>

        {totalActive === 0 ? (
          <Empty className="border border-dashed py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PencilRuler />
              </EmptyMedia>
              <EmptyTitle>
                {listing.archivedCount > 0 ? 'All whiteboards are archived' : 'No whiteboards yet'}
              </EmptyTitle>
              <EmptyDescription>Draw together in #{channelName}.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>{newButton('md')}</EmptyContent>
          </Empty>
        ) : active.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No active whiteboards match “{search}”.</p>
        ) : (
          <CardGroup columns={columns} separated border="outlined" aria-label="Whiteboards">
            {active.map((board) => (
              <Card key={board._id} onClick={() => openBoard(board._id)} label={`Open ${board.title}`}>
                <BoardThumbnail boardId={board._id} title={board.title} />
                <CardHeader className="px-3 pt-3">
                  <CardTitle className="truncate">{board.title}</CardTitle>
                  <CardDescription className="truncate">
                    {activityLine(board)}
                  </CardDescription>
                  {board.activeViewerCount > 0 ? (
                    <CardDescription className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <span aria-hidden className="size-1.5 rounded-full bg-current" />
                      {board.activeViewerCount === 1 ? '1 person here now' : `${board.activeViewerCount} people here now`}
                    </CardDescription>
                  ) : null}
                  <CardAction>
                    <BoardMenu board={board} onRename={() => setRenaming(board)} actions={actions} />
                  </CardAction>
                </CardHeader>
              </Card>
            ))}
          </CardGroup>
        )}

        {listing.archivedCount > 0 ? (
          <ArchivedBoards
            channelId={channelId}
            count={listing.archivedCount}
            search={search}
            actions={actions}
            onRename={setRenaming}
          />
        ) : null}
      </div>
      <RenameDialog
        board={renaming}
        onClose={() => setRenaming(null)}
        onRename={(board, title) => void actions.rename(board, title)}
      />
    </ScrollArea>
  );
}
