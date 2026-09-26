'use client';

import { useMemo, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { History, RotateCcw } from 'lucide-react';
import { useMutation, usePaginatedQuery, useQuery } from '@/lib/convex-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardGroup } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { WhiteboardSnapshotImage } from './whiteboard-snapshot-image';

type Version = {
  key: string;
  toSeq: number;
  title: string;
  detail: string;
  at: number;
};

function when(timestamp: number) {
  if (isToday(timestamp)) return `Today, ${format(timestamp, 'h:mm a')}`;
  if (isYesterday(timestamp)) return `Yesterday, ${format(timestamp, 'h:mm a')}`;
  return format(timestamp, 'MMM d, h:mm a');
}

function changeSummary(counts: { created: number; updated: number; deleted: number; restored: number }) {
  const parts = [
    counts.created ? `added ${counts.created}` : null,
    counts.updated ? `changed ${counts.updated}` : null,
    counts.deleted ? `removed ${counts.deleted}` : null,
    counts.restored ? `brought back ${counts.restored}` : null,
  ].filter(Boolean);
  const text = parts.join(', ');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'No visible changes';
}

type WhiteboardHistorySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: {
    _id: Id<'clubWhiteboards'>;
    title: string;
    createdAt: number;
    archivedAt: number | null;
  };
  onRestored?: () => void;
};

export function WhiteboardHistorySheet({ open, onOpenChange, board, onRestored }: WhiteboardHistorySheetProps) {
  const { toast } = useToast();
  const restoreVersion = useMutation(api.clubs.whiteboards.restoreVersion);
  const { results, status, loadMore } = usePaginatedQuery(
    api.clubs.whiteboards.listRevisions,
    open ? { boardId: board._id } : 'skip',
    { initialNumItems: 30 },
  );

  const versions = useMemo<Version[]>(() => {
    const timeBySeq = new Map(results.map((revision) => [revision.toSeq, revision.updatedAt]));
    const rows: Version[] = results.map((revision) => ({
      key: revision._id,
      toSeq: revision.toSeq,
      at: revision.updatedAt,
      title: revision.actorName,
      detail:
        revision.kind === 'RESTORE'
          ? revision.restoredToSeq !== null && timeBySeq.has(revision.restoredToSeq)
            ? `Restored the version from ${when(timeBySeq.get(revision.restoredToSeq)!)}`
            : revision.restoredToSeq === 0
              ? 'Cleared back to the empty board'
              : 'Restored an earlier version'
          : changeSummary(revision),
    }));
    if (status === 'Exhausted') {
      rows.push({ key: 'created', toSeq: 0, at: board.createdAt, title: 'Empty board', detail: 'When the board was created' });
    }
    return rows;
  }, [board.createdAt, results, status]);

  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  const currentSeq = versions[0]?.toSeq ?? null;
  const selected = versions.find((version) => version.toSeq === selectedSeq) ?? versions[0] ?? null;

  // Reopening the sheet starts from the current version.
  const handleOpenChange = (next: boolean) => {
    if (!next) setSelectedSeq(null);
    onOpenChange(next);
  };

  const preview = useQuery(
    api.clubs.whiteboards.getVersion,
    open && selected ? { boardId: board._id, atSeq: selected.toSeq } : 'skip',
  );

  const [restoring, setRestoring] = useState(false);
  const isCurrent = selected?.toSeq === currentSeq;
  const restore = async () => {
    if (!selected || isCurrent) return;
    setRestoring(true);
    try {
      const { changed } = await restoreVersion({ boardId: board._id, atSeq: selected.toSeq });
      toast({
        title: changed === 0 ? 'Already matches that version' : 'Version restored',
        description: changed === 0 ? undefined : 'The previous state is still in history if you need it back.',
      });
      setSelectedSeq(null);
      onRestored?.();
    } catch (error) {
      const data = (error as { data?: unknown }).data;
      toast({
        title: 'Could not restore that version',
        description: typeof data === 'string' ? data : undefined,
        variant: 'destructive',
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex h-full w-full flex-col gap-4 overflow-hidden sm:max-w-md">
        <SheetHeader className="shrink-0">
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            Every change to “{board.title}” is kept. Pick a version to preview it, then restore it
            for everyone.
          </SheetDescription>
        </SheetHeader>

        <div className="shrink-0 space-y-3">
          {preview === undefined && selected ? (
            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border">
              <Spinner className="size-4" />
            </div>
          ) : preview ? (
            <WhiteboardSnapshotImage
              elements={preview.elements}
              label={`${board.title}, ${selected ? when(selected.at) : ''}`}
              className="aspect-[4/3] w-full"
            />
          ) : null}
          <Button
            type="button"
            className="w-full"
            leadingIcon={RotateCcw}
            loading={restoring}
            disabled={!selected || isCurrent || board.archivedAt !== null}
            onClick={() => void restore()}
          >
            {isCurrent ? 'This is the current version' : 'Restore this version'}
          </Button>
          {board.archivedAt !== null ? (
            <p className="text-xs text-muted-foreground">Restore the board from the archive to change it.</p>
          ) : null}
        </div>

        <ScrollArea className="min-h-0 flex-1">
          {status === 'LoadingFirstPage' ? (
            <div className="flex justify-center py-6">
              <Spinner className="size-4" />
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <History className="size-5" />
              No changes yet.
            </div>
          ) : (
            <CardGroup orientation="inline" aria-label="Versions">
              {versions.map((version, index) => (
                <Card
                  key={version.key}
                  onClick={() => setSelectedSeq(version.toSeq)}
                  selected={version.toSeq === selected?.toSeq}
                  label={`${version.title}, ${when(version.at)}`}
                >
                  <div className="min-w-0 flex-1 py-2.5">
                    <p className="flex items-baseline gap-2 text-sm">
                      <span className="truncate font-medium text-foreground">{version.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{when(version.at)}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {index === 0 ? `Current version · ${version.detail}` : version.detail}
                    </p>
                  </div>
                </Card>
              ))}
            </CardGroup>
          )}
          {status === 'CanLoadMore' || status === 'LoadingMore' ? (
            <div className="flex justify-center py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={status === 'LoadingMore'}
                onClick={() => loadMore(30)}
              >
                Show older versions
              </Button>
            </div>
          ) : null}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
