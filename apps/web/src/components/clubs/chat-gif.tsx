"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
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

function LinkedChatGif({ link }: { link: ChatGifLink }) {
  const resolve = useAction(api.uploads.files.resolveChatGifLink);
  const [resolved, setResolved] = useState<{
    url: string;
    media: string | null;
  } | null>(null);
  useEffect(() => {
    if (link.mediaUrl) return;
    let active = true;
    void resolve({ url: link.url }).then(
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

/** GIFs autoplay unless reduced motion is enabled; the canvas supports pausing. */
export function ChatGif({
  src,
  name,
  pending = false,
}: {
  src: string | null;
  name: string;
  pending?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const reduceMotion = useReducedMotion();
  const [playbackChoice, setPlaying] = useState<boolean | null>(null);
  const playing = playbackChoice ?? reduceMotion === false;
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
          leadingIcon={playing ? Pause : Play}
          aria-label={`${playing ? "Pause" : "Play"} ${name}`}
          onClick={(event) => {
            event.stopPropagation();
            if (playing) drawStill();
            setPlaying(!playing);
          }}
        />
      ) : null}
    </div>
  );
}
