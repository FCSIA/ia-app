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
    const id = setInterval(nextMessage, ROTATE_MS);
    return () => clearInterval(id);
  }, [nextMessage]);

  return (
    <Panel
      title="Did you know?"
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
      <div className="flex h-40 items-center gap-4 rounded-[1.4rem] border border-border/70 bg-muted/20 p-5 sm:h-32 md:h-28">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lightbulb className="size-5" aria-hidden />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
      </div>
    </Panel>
  );
}
