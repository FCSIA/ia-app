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
      className="w-full min-w-0"
      actions={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={nextMessage}
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
