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
      <div className="grid w-full min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-4 rounded-[1.4rem] bg-muted/20 p-5 sm:items-center">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lightbulb className="size-5" aria-hidden />
        </div>
        <p
          className="min-w-0 break-words text-sm leading-relaxed text-muted-foreground"
          title={message}
        >
          {message}
        </p>
      </div>
    </Panel>
  );
}
