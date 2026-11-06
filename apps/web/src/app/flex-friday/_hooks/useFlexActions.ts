import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export type RunFlexAction = (key: string, action: () => Promise<unknown>) => Promise<boolean>;

/**
 * Runs a mutation with one pending key at a time. A failure is toasted here
 * and reported as `false`, so callers only handle success.
 */
export function useFlexActions() {
  const { toast } = useToast();
  const [actionPending, setActionPending] = useState<string | null>(null);

  const runAction: RunFlexAction = async (key, action) => {
    setActionPending(key);
    try {
      await action();
      return true;
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
      return false;
    } finally {
      setActionPending(null);
    }
  };

  return { actionPending, runAction };
}
