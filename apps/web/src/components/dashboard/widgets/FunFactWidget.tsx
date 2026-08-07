'use client';

import { useCallback, useEffect, useState } from 'react';
import { Lightbulb, RefreshCw } from 'lucide-react';
import { Panel } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { pickNavigationLoadingMessage } from '@/lib/navigation-loading-messages';

const ROTATE_MS = 12_000;

export function FunFactWidget() {
  const [message, setMessage] = useState(pickNavigationLoadingMessage);

  const nextMessage = useCallback(() => {
    setMessage(pickNavigationLoadingMessage());
  }, []);

  useEffect(() => {
    const id = setTimeout(nextMessage, ROTATE_MS);
    return () => clearTimeout(id);
  }, [message, nextMessage]);

  return (
    <Panel
      title="Did you know?"
      className="w-full min-w-0"
      contentClassName="min-w-0"
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
      <div className="grid h-40 w-full min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-4 overflow-hidden rounded-[1.4rem] border border-border/70 bg-muted/20 p-5 sm:h-32 md:h-28">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lightbulb className="size-5" aria-hidden />
        </div>
        <p
          className="h-[4.5rem] min-w-0 overflow-hidden text-sm leading-relaxed text-muted-foreground"
          title={message}
        >
          {message}
        </p>
      </div>
    </Panel>
  );
}
