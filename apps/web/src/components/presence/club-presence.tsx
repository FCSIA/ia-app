'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useConvexAuth, useQuery } from '@/lib/convex-react';
import { cn } from '@/lib/utils';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';

export type PresenceStatus = 'online' | 'doNotDisturb';

export const presenceLabels: Record<PresenceStatus, string> = {
  online: 'Online',
  doNotDisturb: 'Do not disturb',
};

const ClubPresenceContext = createContext<ReadonlyMap<string, PresenceStatus>>(new Map());

/**
 * One presence subscription per club, shared by everything on the club's
 * pages. It only lists people who are online right now.
 */
export function ClubPresenceProvider({ clubId, children }: { clubId: string; children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const statuses = useQuery(
    api.presence.status.clubStatuses,
    isAuthenticated ? { clubId: clubId as Id<'clubs'> } : 'skip',
  );
  const byUser = useMemo(
    () => new Map((statuses ?? []).map((entry) => [entry.userId as string, entry.status])),
    [statuses],
  );
  return <ClubPresenceContext.Provider value={byUser}>{children}</ClubPresenceContext.Provider>;
}

/** This person's status in the current club, or undefined while offline. */
export function useMemberPresence(userId: string | undefined) {
  const byUser = useContext(ClubPresenceContext);
  return userId ? byUser.get(userId) : undefined;
}

/**
 * The dot on an avatar's corner. Do Not Disturb adds a bar, so the two read
 * apart without color; the label carries the status for assistive tech.
 */
export function PresenceBadge({ status, className }: { status: PresenceStatus; className?: string }) {
  return (
    <span
      role="img"
      aria-label={presenceLabels[status]}
      title={presenceLabels[status]}
      className={cn(
        'absolute bottom-0 right-0 flex size-2.5 items-center justify-center rounded-full ring-2 ring-card',
        status === 'online' ? 'bg-emerald-500' : 'bg-red-500',
        className,
      )}
    >
      {status === 'doNotDisturb' ? <span className="h-0.5 w-1.5 rounded-full bg-white" /> : null}
    </span>
  );
}

/** An avatar with its presence dot, when the person is online. */
export function PresenceAvatar({
  status,
  children,
  className,
}: {
  status: PresenceStatus | undefined;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {children}
      {status ? <PresenceBadge status={status} /> : null}
    </span>
  );
}
