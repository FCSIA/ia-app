'use client';

import { useMemo, useState } from 'react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@/lib/convex-react';

export type FriendshipStatus = FunctionReturnType<
  typeof api.schedule.friends.getStatuses
>[number]['status'];

/** What a status reads as on a profile or a request button; null when there is no relationship yet. */
export function friendshipLabel(status?: FriendshipStatus) {
  if (status === 'FRIENDS') return 'Friends';
  if (status === 'REQUEST_SENT') return 'Request sent';
  if (status === 'REQUEST_RECEIVED') return 'Request received';
  return null;
}

/**
 * Friendship status for the people on screen, and one in-flight "Add friend"
 * request at a time. `enabled` gates both the lookup and sending.
 */
export function useFriendship({
  targetIds,
  enabled,
}: {
  targetIds: Id<'users'>[];
  enabled: boolean;
}) {
  const { toast } = useToast();
  const [pendingId, setPendingId] = useState<Id<'users'> | null>(null);
  const sendRequest = useMutation(api.schedule.friends.sendRequest);
  const statuses = useQuery(
    api.schedule.friends.getStatuses,
    enabled && targetIds.length > 0 ? { userIds: targetIds } : 'skip',
  );
  const statusByUserId = useMemo(
    () => new Map(statuses?.map(({ userId, status }) => [userId, status])),
    [statuses],
  );

  const send = async (friendId: Id<'users'>) => {
    if (!enabled || pendingId) return;
    setPendingId(friendId);
    try {
      await sendRequest({ friendId });
      toast({ title: 'Friend request sent' });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Failed to send friend request',
        variant: 'destructive',
      });
    } finally {
      setPendingId(null);
    }
  };

  return { statusByUserId, pendingId, send, reset: () => setPendingId(null) };
}
