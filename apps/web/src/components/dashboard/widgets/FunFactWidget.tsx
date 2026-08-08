'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { pickNavigationLoadingFact } from '@ia/fun-facts';
import { Panel } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { LoadingFact } from '@/components/ui/loading-fact';

const ROTATE_MS = 12_000;

export function FunFactWidget() {
  const [fact, setFact] = useState(pickNavigationLoadingFact);

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
      className="w-full min-w-0 h-[200px]"
      contentClassName="min-w-0 flex flex-col justify-center"
      action={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          onClick={nextMessage}
          aria-label="Show another fact"
        >
          <RefreshCw className="size-4" />
        </Button>
      }
    >
      <div
        className="flex w-full min-w-0 flex-1 items-center overflow-hidden rounded-[1.4rem] border border-border/70 bg-muted/20 p-5"
        title={fact.text}
      >
        <LoadingFact fact={fact} className="w-full" />
      </div>
    </Panel>
  );
}
