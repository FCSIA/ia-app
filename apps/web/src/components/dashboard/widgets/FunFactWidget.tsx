'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { pickNavigationLoadingFact } from '@ia/fun-facts';
import { Panel } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { LoadingFact } from '@/components/ui/loading-fact';
import { createEasterEggTapMatcher } from '@/lib/phoenix-easter-egg';
import { useRecordBonusEgg } from '@/hooks/use-founders-quest';
import { useCurrentUser } from '@/lib/auth';

const ROTATE_MS = 12_000;

export function FunFactWidget() {
  const [fact, setFact] = useState(pickNavigationLoadingFact);
  const tapMatcher = useRef<ReturnType<typeof createEasterEggTapMatcher> | null>(null);
  const user = useCurrentUser();
  const recordBonusEgg = useRecordBonusEgg();

  const nextMessage = useCallback(() => {
    setFact(pickNavigationLoadingFact());
  }, []);

  useEffect(() => {
    const id = setTimeout(nextMessage, ROTATE_MS);
    return () => clearTimeout(id);
  }, [fact, nextMessage]);

  return (
    <Panel
      title="Did you know?"
      className="w-full min-w-0"
      actions={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            if (!user?.roles.some((role) => role === 'STUDENT' || role === 'STUDENT_LEADER')) { nextMessage(); return; }
            tapMatcher.current ??= createEasterEggTapMatcher();
            if (tapMatcher.current(Date.now())) {
              void recordBonusEgg('funFact').then((found) => {
                if (found) setFact({ id: 'dashboard-phoenix-secret', text: 'You found the secret fact: the Phoenix is always ready for another beginning.', category: 'phoenix', visual: 'phoenix' });
              });
            } else nextMessage();
          }}
          aria-label="Show another fact"
        >
          <RefreshCw />
        </Button>
      }
    >
      <div
        className="flex min-h-20 w-full min-w-0 items-center"
        title={fact.text}
      >
        <LoadingFact fact={fact} className="w-full" />
      </div>
    </Panel>
  );
}
