'use client';

import { useQuery } from '@/lib/convex-react';
import { WhiteboardSnapshotImage } from '@/components/clubs/whiteboard/whiteboard-snapshot-image';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { AdminNotice } from '../admin-ui';

type WhiteboardAuditSnapshotProps = {
  boardId: Id<'clubWhiteboards'>;
  atSeq: number;
};

/**
 * Renders the board exactly as it stood right after an audited edit, rebuilt
 * from the retained element history rather than the live board.
 */
export function WhiteboardAuditSnapshot({ boardId, atSeq }: WhiteboardAuditSnapshotProps) {
  const snapshot = useQuery(api.clubs.whiteboards.getAuditSnapshot, { boardId, atSeq });

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
          This board has a long history; only the most recent changes are shown.
        </p>
      ) : null}
    </div>
  );
}
