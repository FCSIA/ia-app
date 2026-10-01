"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGifAutoplay } from "@/hooks/use-gif-autoplay";
import { useAction } from "@/lib/convex-react";
import { api } from "~/apps/convex/src/_generated/api";
import { extractChatGifLinks, type ChatGifLink } from "~/apps/shared/chat/gifs";

export function ChatGifLinks({ text }: { text: string }) {
  return (
    <>
      {extractChatGifLinks(text).map((link) => (
        <LinkedChatGif key={link.url} link={link} />
      ))}
    </>
  );
}

/**
 * Share links resolved this session. Remounting a message (scrolling, channel
 * switches) reuses the result instead of asking the server again.
 */
const resolvedShareLinks = new Map<string, Promise<string | null>>();
const MAX_RESOLVED_SHARE_LINKS = 200;

function resolveShareLink(
  resolve: (args: { url: string }) => Promise<string | null>,
  url: string,
) {
  let pending = resolvedShareLinks.get(url);
  if (!pending) {
    pending = resolve({ url }).catch((error: unknown) => {
      // Failures (rate limits, offline) are retried on the next mount.
      resolvedShareLinks.delete(url);
      throw error;
    });
    resolvedShareLinks.set(url, pending);
    if (resolvedShareLinks.size > MAX_RESOLVED_SHARE_LINKS) {
      resolvedShareLinks.delete(resolvedShareLinks.keys().next().value!);
    }
  }
  return pending;
}

function LinkedChatGif({ link }: { link: ChatGifLink }) {
  const resolve = useAction(api.uploads.files.resolveChatGifLink);
  const [resolved, setResolved] = useState<{
    url: string;
    media: string | null;
  } | null>(null);
  useEffect(() => {
    if (link.mediaUrl) return;
    let active = true;
    void resolveShareLink(resolve, link.url).then(
      (media) => {
        if (active) setResolved({ url: link.url, media });
      },
      () => {
        if (active) setResolved({ url: link.url, media: null });
      },
    );
    return () => {
      active = false;
    };
  }, [link.url, link.mediaUrl, resolve]);
  const media =
    link.mediaUrl ?? (resolved?.url === link.url ? resolved.media : null);
  return (
    <ChatGif
      key={media ?? link.url}
      src={media}
      name="GIF"
      pending={!link.mediaUrl && resolved?.url !== link.url}
    />
  );
}

/**
 * GIFs autoplay unless reduced motion is enabled; the canvas supports pausing.
 * Copying a GIF's URL lives in the message's own context menu, so a GIF never
 * opens a second menu over the message actions.
 */
export function ChatGif({
  src,
  name,
  pending = false,
}: {
  src: string | null;
  name: string;
  pending?: boolean;
}) {
  const { autoplay } = useGifAutoplay();
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const reduceMotion = useReducedMotion();
  const [playbackChoice, setPlaying] = useState<boolean | null>(null);
  const playing = playbackChoice ?? (autoplay && reduceMotion === false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const drawStill = useCallback(() => {
    const target = canvas.current;
    const source = image.current;
    if (!target || !source?.naturalWidth) return;
    const scale = Math.min(
      1,
      840 / source.naturalWidth,
      640 / source.naturalHeight,
    );
    target.width = Math.round(source.naturalWidth * scale);
    target.height = Math.round(source.naturalHeight * scale);
    target
      .getContext("2d")
      ?.drawImage(source, 0, 0, target.width, target.height);
  }, []);
  useEffect(() => {
    if (reduceMotion) setPlaying(false);
  }, [reduceMotion]);
  useEffect(() => { setPlaying(null); }, [autoplay]);
  return (
    <div className="relative my-2 w-fit max-w-full">
      {src && !failed ? (
        <div className="max-w-full">
          <Image
            unoptimized
            loading="eager"
            width={840}
            height={640}
            ref={image}
            src={src}
            alt={name}
            referrerPolicy="no-referrer"
            hidden={!playing}
            className="h-auto w-auto max-h-80 max-w-full object-contain"
            onLoad={() => {
              drawStill();
              setReady(true);
            }}
            onError={() => {
              setFailed(true);
            }}
          />
          <canvas
            ref={canvas}
            hidden={playing || !ready}
            role="img"
            aria-label={`${name} (paused)`}
            className="max-h-80 max-w-full object-contain"
          />
        </div>
      ) : null}
      {pending || (src && !ready && !failed) ? (
        <p role="status" className="text-xs text-muted-foreground">
          Loading…
        </p>
      ) : failed || !src ? (
        <p role="status" className="text-xs text-muted-foreground">
          Animation unavailable
        </p>
      ) : null}
      {src && !failed ? (
        <Button
          size="icon-compact"
          variant="secondary"
          className="absolute bottom-2 right-2"
          disabled={!ready}
          aria-label={`${playing ? "Pause" : "Play"} ${name}`}
          onClick={(event) => {
            event.stopPropagation();
            if (playing) drawStill();
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </Button>
      ) : null}
    </div>
  );
}
