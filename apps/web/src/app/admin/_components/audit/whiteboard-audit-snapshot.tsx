'use client';

import { useEffect, useState } from 'react';
import type { FunctionReturnType } from 'convex/server';
import { useConvex } from '@/lib/convex-react';
import { WhiteboardSnapshotImage } from '@/components/clubs/whiteboard/whiteboard-snapshot-image';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { AdminNotice } from '../admin-ui';

type WhiteboardAuditSnapshotProps = {
  boardId: Id<'clubWhiteboards'>;
  atSeq: number;
};

type Snapshot = FunctionReturnType<typeof api.clubs.whiteboards.getAuditSnapshot>;

/**
 * Renders the board exactly as it stood right after an audited edit, rebuilt
 * from the retained element history. A past state never changes, so it is
 * fetched once instead of re-running while people keep drawing.
 */
export function WhiteboardAuditSnapshot({ boardId, atSeq }: WhiteboardAuditSnapshotProps) {
  const convex = useConvex();
  const key = `${boardId}:${atSeq}`;
  const [loaded, setLoaded] = useState<{ key: string; snapshot: Snapshot } | null>(null);
  useEffect(() => {
    let active = true;
    convex.query(api.clubs.whiteboards.getAuditSnapshot, { boardId, atSeq }).then(
      (snapshot) => {
        if (active) setLoaded({ key, snapshot });
      },
      () => {
        if (active) setLoaded({ key, snapshot: null });
      },
    );
    return () => {
      active = false;
    };
  }, [atSeq, boardId, convex, key]);
  const snapshot = loaded?.key === key ? loaded.snapshot : undefined;

  if (snapshot === undefined) return <AdminNotice message="Loading whiteboard snapshot..." />;
  if (snapshot === null) return <AdminNotice message="This whiteboard snapshot is unavailable." />;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Board after this change
      </p>
      <WhiteboardSnapshotImage
        elements={snapshot.elements}
        label={`${snapshot.title} after this change`}
        className="aspect-[4/3] w-full"
      />
      {snapshot.truncated ? (
        <p className="text-xs text-muted-foreground">
          This version is too large to show completely.
        </p>
      ) : null}
    </div>
  );
}
