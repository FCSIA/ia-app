"use client";

import { useMemo } from "react";
import { AnimatedGif } from "@/components/media/animated-gif";
import { useMediaVisibility } from "@/hooks/use-media-visibility";
import { useStoredGifs } from "@/hooks/use-stored-gifs";
import { Button } from "@/components/ui/button";
import { gifErrorMessage } from "~/apps/shared/chat/stored-gifs";
import { extractChatGifLinks, type ChatGifLink } from "~/apps/shared/chat/gifs";

export function ChatGifLinks({ text }: { text: string }) {
  const links = useMemo(() => extractChatGifLinks(text), [text]);
  return <>{links.map((link) => <LinkedChatGif key={link.url} link={link} />)}</>;
}

function LinkedChatGif({ link }: { link: ChatGifLink }) {
  const { ref, nearby, pageActive } = useMediaVisibility();
  const urls = useMemo(() => [link.url], [link.url]);
  const { states, retry } = useStoredGifs(urls, nearby && pageActive);
  const asset = states[0];
  return (
    <div ref={ref} className="max-w-full">
      {asset.status === "error" ? (
        <div className="flex flex-wrap items-center gap-2" role="status">
          <p className="text-sm text-muted-foreground">{gifErrorMessage(asset.error)}</p>
          <Button type="button" size="sm" variant="ghost" onClick={() => retry(link.url)}>Retry GIF</Button>
        </div>
      ) : <AnimatedGif src={asset.url} name="GIF" pending={asset.status !== "ready"} />}
    </div>
  );
}
