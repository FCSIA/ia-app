"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatedGif } from "@/components/media/animated-gif";
import { useMediaVisibility } from "@/hooks/use-media-visibility";
import { useAction } from "@/lib/convex-react";
import { api } from "~/apps/convex/src/_generated/api";
import { createGifLinkCache } from "~/apps/shared/chat/gif-link-cache";
import { extractChatGifLinks, type ChatGifLink } from "~/apps/shared/chat/gifs";

export function ChatGifLinks({ text }: { text: string }) {
  const links = useMemo(() => extractChatGifLinks(text), [text]);
  return <>{links.map((link) => <LinkedChatGif key={link.url} link={link} />)}</>;
}

const resolveShareLink = createGifLinkCache();

function LinkedChatGif({ link }: { link: ChatGifLink }) {
  const { ref, nearby, pageActive } = useMediaVisibility();
  const resolve = useAction(api.uploads.files.resolveChatGifLink);
  const [resolved, setResolved] = useState<{ url: string; media: string | null } | null>(null);
  useEffect(() => {
    if (link.mediaUrl || !nearby || !pageActive || resolved?.url === link.url) return;
    let active = true;
    void resolveShareLink(resolve, link.url).then(
      (media) => { if (active) setResolved({ url: link.url, media }); },
      () => { if (active) setResolved({ url: link.url, media: null }); },
    );
    return () => { active = false; };
  }, [link.url, link.mediaUrl, resolve, nearby, pageActive, resolved?.url]);
  const media = link.mediaUrl ?? (resolved?.url === link.url ? resolved.media : null);
  return (
    <div ref={ref} className="max-w-full">
      <AnimatedGif src={media} name="GIF" pending={!link.mediaUrl && resolved?.url !== link.url} />
    </div>
  );
}
