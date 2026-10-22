'use client';

import { useState } from 'react';
import { ImageOff, X } from 'lucide-react';
import {
  Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle,
  AttachmentActions,
} from '@/components/ui/attachment';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AnimatedGif } from '@/components/media/animated-gif';
import { gifErrorMessage, type StoredGif } from '~/apps/shared/chat/stored-gifs';

export function ComposerGifPreview({
  asset, index, disabled, onRetry, onRemove,
}: {
  asset: StoredGif;
  index: number;
  disabled: boolean;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const imageFailed = !!asset.url && failedUrl === asset.url;
  const error = asset.status === 'error' || imageFailed;
  const ready = asset.status === 'ready' && !error;
  const label = `GIF ${index + 1}`;
  return (
    <Attachment state={error ? 'error' : ready ? 'done' : 'processing'} className="w-full sm:w-auto" aria-label={label}>
      {!ready ? (
        <AttachmentMedia>
          {error ? <ImageOff aria-hidden /> : <Spinner aria-label="Preparing GIF" />}
        </AttachmentMedia>
      ) : null}
      <AttachmentContent>
        <AttachmentTitle>{error ? "Couldn't load GIF" : ready ? label : 'Preparing GIF…'}</AttachmentTitle>
        {error ? (
          <p role="status" className="mt-1 max-w-64 text-sm text-muted-foreground">
            {gifErrorMessage(asset.error)} Retry or remove it to continue.
          </p>
        ) : ready ? (
          <AnimatedGif key={attempt} src={asset.url} name={label} maxHeight={128} maxWidth={220} onError={() => setFailedUrl(asset.url)} />
        ) : (
          <p role="status" className="mt-1 text-sm text-muted-foreground">Getting your preview ready.</p>
        )}
      </AttachmentContent>
      <AttachmentActions>
        {error ? (
          <Button type="button" variant="secondary" size="sm" disabled={disabled}
            aria-label={`Retry ${label}`}
            onClick={() => { setFailedUrl(null); setAttempt((value) => value + 1); onRetry(); }}>
            Retry
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${label}`} disabled={disabled} onClick={onRemove}>
          <X aria-hidden />
        </Button>
      </AttachmentActions>
    </Attachment>
  );
}
