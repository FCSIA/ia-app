'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConvex, useMutation, useQuery } from '@/lib/convex-react';
import { useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { api } from '~/apps/convex/src/_generated/api';

export type QuestKey = 'copper' | 'jade' | 'crystal';
export type BonusEgg = 'phoenix' | 'today' | 'funFact';

export function useFoundersQuest() {
  const user = useCurrentUser();
  const convex = useConvex();
  const userId = user?._id;
  const [probe, setProbe] = useState<{ userId: string; supported: boolean } | null>(null);
  const supported = probe && probe.userId === userId ? probe.supported : null;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void convex.query(api.easterEggs.finders.myProgress, {}).then(() => {
      if (active) setProbe({ userId, supported: true });
    }).catch(() => {
      if (active) setProbe({ userId, supported: false });
    });
    return () => { active = false; };
  }, [convex, userId]);

  const progress = useQuery(api.easterEggs.finders.myProgress, supported ? {} : 'skip');
  return { progress, supported };
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
  const recordBonusDiscovery = useMutation(api.easterEggs.finders.recordBonusDiscovery);
  const { toast } = useToast();
  return useCallback(async (egg: BonusEgg) => {
    try {
      const found = await recordBonusDiscovery({ egg });
      if (found) toast({ title: 'Hidden secret found', description: 'Your discovery was saved to your profile.' });
      return found;
    } catch (error) {
      toast({ title: 'Secret not saved', description: error instanceof Error ? error.message : 'Try again in a moment.', variant: 'destructive' });
      return false;
    }
  }, [recordBonusDiscovery, toast]);
}
