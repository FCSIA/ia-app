'use client';

import { useCallback } from 'react';
import { useMutation, useQuery } from '@/lib/convex-react';
import { useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { api } from '~/apps/convex/src/_generated/api';

export type QuestKey = 'copper' | 'jade' | 'crystal';
export type BonusEgg = 'phoenix' | 'today' | 'funFact';

export function useFoundersQuest() {
  const user = useCurrentUser();
  const progress = useQuery(api.easterEggs.finders.myProgress, user ? {} : 'skip');
  return { progress, supported: Boolean(user) };
}

export function useRecordQuestKey() {
  const recordDiscovery = useMutation(api.easterEggs.finders.recordDiscovery);
  const { toast } = useToast();

  return useCallback(async (key: QuestKey) => {
    try {
      return await recordDiscovery({ key });
    } catch (error) {
      toast({
        title: 'Quest key not saved',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      });
      return false;
    }
  }, [recordDiscovery, toast]);
}

export function useRecordBonusEgg() {
  const user = useCurrentUser();
  const recordBonusDiscovery = useMutation(api.easterEggs.finders.recordBonusDiscovery);
  const { toast } = useToast();
  return useCallback(async (egg: BonusEgg) => {
    if (!user?.roles.some((role) => role === 'STUDENT' || role === 'STUDENT_LEADER')) return false;
    try {
      const found = await recordBonusDiscovery({ egg });
      if (found) toast({ title: 'Hidden secret found', description: 'Your discovery was saved to your profile.' });
      return found;
    } catch (error) {
      toast({ title: 'Secret not saved', description: error instanceof Error ? error.message : 'Try again in a moment.', variant: 'destructive' });
      return false;
    }
  }, [recordBonusDiscovery, toast, user]);
}
