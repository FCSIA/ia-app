'use client';

import { useState } from 'react';
import { ImageOff, X } from 'lucide-react';
import {
  Attachment, AttachmentContent, AttachmentTitle,
  AttachmentActions,
} from '@/components/ui/attachment';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AnimatedGif } from '@/components/media/animated-gif';
import { gifErrorMessage, type StoredGif } from '~/apps/shared/chat/stored-gifs';

export function ComposerGifPreview({
  asset, disabled, onRetry, onRemove,
}: {
  asset: StoredGif;
  disabled: boolean;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const imageFailed = !!asset.url && failedUrl === asset.url;
  const error = asset.status === 'error' || imageFailed;
  const ready = asset.status === 'ready' && !error;
  if (ready) return (
    <div role="group" aria-label="GIF preview" className="relative w-fit max-w-full">
      <AnimatedGif key={attempt} src={asset.url} name="GIF" maxHeight={128} maxWidth={220}
        className="my-0" onError={() => setFailedUrl(asset.url)} />
      <Button type="button" variant="secondary" size="icon-compact" className="absolute right-2 top-2"
        aria-label="Remove GIF" disabled={disabled} onClick={onRemove}>
        <X aria-hidden />
      </Button>
    </div>
  );
  return (
    <Attachment state={error ? 'error' : 'processing'} aria-label="GIF preview">
      <AttachmentContent className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {error ? <ImageOff className="size-4 shrink-0" aria-hidden /> : <Spinner aria-label="Preparing GIF" />}
            <AttachmentTitle>{error ? "Couldn't load GIF" : 'Preparing GIF…'}</AttachmentTitle>
          </div>
          <AttachmentActions>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove GIF" disabled={disabled} onClick={onRemove}>
              <X aria-hidden />
            </Button>
          </AttachmentActions>
        </div>
        {error ? (
          <p role="status" className="max-w-64 text-sm text-muted-foreground">
            {gifErrorMessage(asset.error)} Retry or remove it to continue.
          </p>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">Getting your preview ready.</p>
        )}
        {error ? (
          <Button type="button" variant="secondary" size="sm" className="self-start" disabled={disabled}
            aria-label="Retry GIF"
            onClick={() => { setFailedUrl(null); setAttempt((value) => value + 1); onRetry(); }}>
            Retry
          </Button>
        ) : null}
      </AttachmentContent>
    </Attachment>
  );
}
