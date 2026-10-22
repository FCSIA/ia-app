'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useReducedMotion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGifAutoplay } from '@/hooks/use-gif-autoplay';
import { useMediaVisibility } from '@/hooks/use-media-visibility';
import { cn } from '@/lib/utils';

type AnimatedGifProps = {
  src: string | null;
  name: string;
  pending?: boolean;
  maxHeight?: number;
  maxWidth?: number;
  active?: boolean;
  fullWidth?: boolean;
  className?: string;
  /** Composer thumbnails show a still; the sent media retains its full animation. */
  thumbnail?: boolean;
  onError?: () => void;
};

export function AnimatedGif(props: AnimatedGifProps) {
  // Recycled messages/new sources must not inherit another image's failure or still.
  return <GifPlayer key={props.src ?? 'pending'} {...props} />;
}

function GifPlayer({ src, name, pending = false, maxHeight = 320, maxWidth = 840, active = true, fullWidth = false, thumbnail = false, className, onError }: AnimatedGifProps) {
  const { autoplay } = useGifAutoplay();
  const { ref, visible, nearby, pageActive } = useMediaVisibility();
  const reduceMotion = useReducedMotion();
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const [playbackChoice, setPlaying] = useState<boolean | null>(null);
  const requested = playbackChoice ?? (autoplay && reduceMotion === false);
  const playing = requested && visible && pageActive && active && !thumbnail;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState({ width: Math.min(420, maxHeight * 1.3125), height: maxHeight });

  const drawStill = useCallback((source: HTMLImageElement) => {
    const target = canvas.current;
    if (!target || !source.naturalWidth || !source.naturalHeight) return;
    // Bound retained pixels to the rendered size at up to 2x, rather than the upload size.
    const scale = Math.min(1, maxWidth * 2 / source.naturalWidth, maxHeight * 2 / source.naturalHeight);
    target.width = Math.max(1, Math.round(source.naturalWidth * scale));
    target.height = Math.max(1, Math.round(source.naturalHeight * scale));
    target.getContext('2d')?.drawImage(source, 0, 0, target.width, target.height);
  }, [maxHeight, maxWidth]);
  const imageRef = useCallback((node: HTMLImageElement | null) => {
    // Capture before React removes the animated source. A hidden <img> is not a pause API.
    if (!node && image.current) drawStill(image.current);
    image.current = node;
  }, [drawStill]);

  useEffect(() => { if (reduceMotion) setPlaying(false); }, [reduceMotion]);
  useEffect(() => { setPlaying(null); }, [autoplay]);
  useEffect(() => {
    if (!nearby && ready && canvas.current) {
      // Far-away messages retain geometry, not large canvas backing buffers.
      canvas.current.width = 1;
      canvas.current.height = 1;
      setReady(false);
    }
  }, [nearby, ready]);

  // Preload just one frame near the viewport. Paused/offscreen animations have no img node.
  const loadImage = src && !failed && nearby && pageActive && active && (playing || !ready);
  return (
    <div
      ref={ref}
      className={cn('relative my-2 max-w-full', thumbnail && 'my-0 size-full', className)}
      style={thumbnail ? undefined : { width: fullWidth ? '100%' : size.width }}
    >
      {(src || pending) && !failed ? (
        <div className={cn('relative max-w-full overflow-hidden rounded-xl', thumbnail && 'size-full')}>
          <canvas
            ref={canvas}
            width={1}
            height={1}
            role="img"
            aria-label={`${name} (paused)`}
            aria-hidden={playing || !ready}
            className={cn('block w-full object-contain', (!ready || playing) && 'invisible', thumbnail && 'size-full object-cover')}
            style={thumbnail ? undefined : { height: 'auto', maxHeight, aspectRatio: `${size.width} / ${size.height}` }}
          />
          {loadImage ? (
            <Image
              unoptimized
              loading="eager"
              decoding="async"
              width={840}
              height={640}
              ref={imageRef}
              src={src}
              alt={name}
              referrerPolicy="no-referrer"
              aria-hidden={!playing}
              className={cn('absolute inset-0 size-full object-contain', !playing && 'invisible', thumbnail && 'object-cover')}
              onLoad={(event) => {
                const source = event.currentTarget;
                drawStill(source);
                const scale = Math.min(1, maxWidth / source.naturalWidth, maxHeight / source.naturalHeight);
                setSize({ width: source.naturalWidth * scale, height: source.naturalHeight * scale });
                setReady(true);
              }}
              onError={() => { setFailed(true); onError?.(); }}
            />
          ) : null}
        </div>
      ) : null}
      {!thumbnail && (pending || (src && !ready && !failed)) ? (
        <p role="status" className="text-xs text-muted-foreground">Loading…</p>
      ) : failed || (!src && !pending) ? (
        <p role="status" className="text-xs text-muted-foreground">Animation unavailable</p>
      ) : null}
      {src && !failed && !thumbnail ? (
        <Button
          size="icon-compact"
          variant="secondary"
          className="absolute bottom-2 right-2"
          disabled={!ready}
          aria-label={`${requested ? 'Pause' : 'Play'} ${name}`}
          onClick={(event) => {
            event.stopPropagation();
            setPlaying(!requested);
          }}
        >
          {requested ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </Button>
      ) : null}
    </div>
  );
}
