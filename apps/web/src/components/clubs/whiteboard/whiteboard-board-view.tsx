'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  CloudOff,
  Copy,
  History,
  Link2,
  Loader2,
  MoreHorizontal,
  PenLine,
} from 'lucide-react';
import { useQuery } from '@/lib/convex-react';
import { Button } from '@/components/ui/button';
import { DropdownContent, DropdownMenu, DropdownTrigger } from '@/components/ui/dropdown';
import { Input } from '@/components/ui/input';
import { MenuItem } from '@/components/ui/menu-item';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip } from '@/components/ui/tooltip';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import type { WhiteboardCanvasHandle, WhiteboardSyncState } from './whiteboard-canvas';
import { WhiteboardHistorySheet } from './whiteboard-history-sheet';
import { useWhiteboardActions, useWhiteboardRoute } from './use-whiteboard-actions';

// The editor is large and browser-only; load it only when a board is opened.
const WhiteboardCanvas = dynamic(() => import('./whiteboard-canvas'), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center gap-2 text-sm text-muted-foreground">
      <Spinner className="size-4" />
      Loading whiteboard…
    </div>
  ),
});

/** Themes that render on a dark surface (mirrors the app's dark variant). */
const DARK_THEMES = new Set(['dark', 'high-contrast', 'bubblegum-dark', 'custom']);

function SyncStatus({ state }: { state: WhiteboardSyncState }) {
  const content =
    state === 'saving'
      ? { icon: Loader2, label: 'Saving…', className: 'animate-spin' }
      : state === 'error'
        ? { icon: CloudOff, label: 'Not saved', className: 'text-destructive' }
        : { icon: Check, label: 'Saved', className: '' };
  const Icon = content.icon;
  return (
    <span role="status" className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
      <Icon className={`size-3.5 ${content.className}`} />
      {content.label}
    </span>
  );
}

function TitleEditor({
  title,
  editable,
  editing,
  onEditingChange,
  onRename,
}: {
  title: string;
  editable: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onRename: (title: string) => void;
}) {
  const [draft, setDraft] = useState(title);
  if (editing) {
    const commit = () => {
      onEditingChange(false);
      if (draft.trim() && draft.trim() !== title) onRename(draft);
    };
    return (
      <Input
        autoFocus
        value={draft}
        maxLength={80}
        aria-label="Whiteboard name"
        className="h-7 w-56 max-w-[40vw] text-sm"
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') {
            setDraft(title);
            onEditingChange(false);
          }
        }}
      />
    );
  }
  return (
    <Tooltip content={editable ? 'Rename' : title}>
      <button
        type="button"
        disabled={!editable}
        onClick={() => {
          setDraft(title);
          onEditingChange(true);
        }}
        className="min-w-0 truncate rounded-md px-1.5 py-0.5 text-sm font-semibold text-foreground outline-none hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring disabled:hover:bg-transparent"
      >
        {title}
      </button>
    </Tooltip>
  );
}

export function WhiteboardBoardView({
  channelId,
  boardId,
}: {
  channelId: Id<'clubChannels'>;
  boardId: Id<'clubWhiteboards'>;
}) {
  const { resolvedTheme } = useTheme();
  const board = useQuery(api.clubs.whiteboards.get, { boardId });
  const actions = useWhiteboardActions(channelId);
  const { closeBoard } = useWhiteboardRoute();
  const [syncState, setSyncState] = useState<WhiteboardSyncState>('saved');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const canvas = useRef<WhiteboardCanvasHandle | null>(null);

  if (board === undefined) {
    return (
      <div className="flex size-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Opening whiteboard…
      </div>
    );
  }
  if (board === null || board.channelId !== channelId) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
        This whiteboard doesn&apos;t exist or you don&apos;t have access to it.
        <Button type="button" variant="secondary" size="sm" leadingIcon={ArrowLeft} onClick={closeBoard}>
          All whiteboards
        </Button>
      </div>
    );
  }

  const archived = board.archivedAt !== null;
  const summary = { _id: board._id, title: board.title };
  const flushCanvas = () => canvas.current?.flush() ?? Promise.resolve();
  // Send the last strokes before the board becomes read-only, and only leave
  // it once the archive actually happened.
  const archiveBoard = async () => {
    await flushCanvas();
    if (await actions.archive(summary, true)) closeBoard();
  };
  const menuItems = archived
    ? [
        { label: 'Restore from archive', icon: ArchiveRestore, onSelect: () => void actions.archive(summary, false) },
        { label: 'Duplicate', icon: Copy, onSelect: () => void actions.duplicate(summary, flushCanvas) },
      ]
    : [
        { label: 'Rename', icon: PenLine, onSelect: () => setEditingTitle(true) },
        { label: 'Duplicate', icon: Copy, onSelect: () => void actions.duplicate(summary, flushCanvas) },
        { label: 'Share link', icon: Link2, onSelect: () => void actions.share(summary) },
        { label: 'Archive', icon: Archive, onSelect: () => void archiveBoard() },
      ];

  return (
    <div className="flex size-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1">
        <Tooltip content="All whiteboards">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="All whiteboards" onClick={closeBoard}>
            <ArrowLeft />
          </Button>
        </Tooltip>
        <TitleEditor
          key={board.title}
          title={board.title}
          editable={!archived}
          editing={editingTitle}
          onEditingChange={setEditingTitle}
          onRename={(title) => void actions.rename(summary, title)}
        />
        {archived ? null : <SyncStatus state={syncState} />}
        <div className="flex-1" />
        <Tooltip content="Version history">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leadingIcon={History}
            aria-label="History"
            onClick={() => setHistoryOpen(true)}
          >
            <span className="hidden sm:inline">History</span>
          </Button>
        </Tooltip>
        <DropdownMenu>
          <DropdownTrigger
            render={
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Whiteboard actions">
                <MoreHorizontal />
              </Button>
            }
          />
          <DropdownContent align="end">
            {menuItems.map((item, index) => (
              <MenuItem key={item.label} index={index} icon={item.icon} label={item.label} onSelect={item.onSelect} />
            ))}
          </DropdownContent>
        </DropdownMenu>
      </div>

      {archived ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Archived · read-only
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            leadingIcon={ArchiveRestore}
            onClick={() => void actions.archive(summary, false)}
          >
            Restore
          </Button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <WhiteboardCanvas
          key={board._id}
          boardId={board._id}
          readOnly={archived}
          theme={DARK_THEMES.has(resolvedTheme ?? '') ? 'dark' : 'light'}
          onSyncStateChange={setSyncState}
          handleRef={canvas}
        />
      </div>

      <WhiteboardHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        board={board}
        onRestored={() => canvas.current?.refreshThumbnail()}
      />
    </div>
  );
}
