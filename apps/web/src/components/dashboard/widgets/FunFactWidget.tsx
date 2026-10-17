'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { pickNavigationLoadingFact } from '@ia/fun-facts';
import { Panel } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { LoadingFact } from '@/components/ui/loading-fact';
import { useToast } from '@/hooks/use-toast';
import { createEasterEggTapMatcher } from '@/lib/phoenix-easter-egg';

const ROTATE_MS = 12_000;

export function FunFactWidget() {
  const [fact, setFact] = useState(pickNavigationLoadingFact);
  const tapMatcher = useRef(createEasterEggTapMatcher());
  const { toast } = useToast();

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
      className="w-full min-w-0 [&>div:first-child]:flex-row [&>div:first-child]:items-center [&>div:first-child]:justify-between"
      contentClassName="min-w-0 px-6 pb-6 pt-3 sm:p-6"
      action={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onClick={() => {
            if (tapMatcher.current(Date.now())) {
              setFact({
                id: 'dashboard-phoenix-secret',
                text: 'You found the secret fact: the Phoenix is always ready for another beginning.',
                category: 'phoenix',
                visual: 'phoenix',
              });
              toast({ title: 'Secret fact found!', description: 'The Phoenix was hiding in plain sight.' });
            } else {
              nextMessage();
            }
          }}
          aria-label="Show another fact"
        >
          <RefreshCw />
        </Button>
      }
    >
      <div
        className="flex min-h-20 w-full min-w-0 items-center rounded-[1.4rem] bg-muted/20 p-4 sm:min-h-24 sm:p-5"
        title={fact.text}
      >
        <LoadingFact fact={fact} className="w-full" />
      </div>
    </Panel>
  );
}
