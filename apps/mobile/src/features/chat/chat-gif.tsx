import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { useReducedMotion } from "react-native-reanimated";
import { Pause, Play } from "lucide-react-native";
import { IconButton, Txt } from "@/components/ui";
import { useGifAutoplay, useGifAppActive } from "@/lib/gif-playback";
import { MediaVisibleContext, useMediaVisibility } from "@/lib/media-visibility";
import { useReduceMotion } from "@/lib/motion";
import { spacing } from "@/lib/tokens";
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
  const visible = useContext(MediaVisibleContext);
  const appActive = useGifAppActive();
  const resolve = useAction(api.uploads.files.resolveChatGifLink);
  const [resolved, setResolved] = useState<{ url: string; media: string | null } | null>(null);
  useEffect(() => {
    if (link.mediaUrl || !visible || !appActive || resolved?.url === link.url) return;
    let active = true;
    void resolveShareLink(resolve, link.url).then(
      (media) => { if (active) setResolved({ url: link.url, media }); },
      () => { if (active) setResolved({ url: link.url, media: null }); },
    );
    return () => { active = false; };
  }, [link.url, link.mediaUrl, resolve, visible, appActive, resolved?.url]);
  const media = link.mediaUrl ?? (resolved?.url === link.url ? resolved.media : null);
  return <ChatGif src={media} name="GIF" pending={!link.mediaUrl && resolved?.url !== link.url} />;
}

type ChatGifProps = { src: string | null; name: string; pending?: boolean; active?: boolean };
export function ChatGif(props: ChatGifProps) {
  return <GifPlayer key={props.src ?? 'pending'} {...props} />;
}

/** Visibility suspends actual native animation without overwriting the user's play/pause choice. */
function GifPlayer({ src, name, pending = false, active = true }: ChatGifProps) {
  const { autoplay } = useGifAutoplay();
  const appActive = useGifAppActive();
  const { ref, onLayout, visible } = useMediaVisibility();
  const image = useRef<Image>(null);
  const reduceMotion = useReduceMotion();
  const initialReduceMotion = useReducedMotion();
  const [playbackChoice, setPlaying] = useState<boolean | null>(null);
  const requested = playbackChoice ?? (autoplay && !initialReduceMotion && !reduceMotion);
  const playing = requested && visible && appActive && active;
  const wantsPlaying = useRef(playing);
  wantsPlaying.current = playing;
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [failed, setFailed] = useState(false);
  const playbackTask = useRef(Promise.resolve());
  const applyPlayback = useCallback(() => {
    const current = image.current;
    if (!current || !readyRef.current) return;
    // Native methods are asynchronous. Serialize them and read the latest intent,
    // so a delayed start can never win over a newer offscreen/background pause.
    playbackTask.current = playbackTask.current.catch(() => {}).then(async () => {
      if (image.current !== current) return;
      if (wantsPlaying.current) await current.startAnimating();
      else await current.stopAnimating();
    }).catch(() => { if (image.current === current) setPlaying(false); });
  }, []);
  useEffect(() => { applyPlayback(); }, [playing, applyPlayback]);
  useEffect(() => { if (reduceMotion) setPlaying(false); }, [reduceMotion]);
  useEffect(() => { setPlaying(null); }, [autoplay]);

  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={onLayout}
      accessibilityLabel={name}
      style={{ width: Math.min(440, 220 * aspectRatio), maxWidth: "100%" }}
    >
      {(src || pending) && !failed ? (
        <View style={{ width: "100%", aspectRatio }}>
          {src && ((visible && appActive && active) || ready) ? (
            <Image
              ref={image}
              source={{ uri: src }}
              recyclingKey={src}
              alt={name}
              autoplay={false}
              allowDownscaling
              contentFit="contain"
              cachePolicy="memory-disk"
              onLoad={({ source }) => {
                if (source.width > 0 && source.height > 0) setAspectRatio(source.width / source.height);
                readyRef.current = true;
                setReady(true);
                applyPlayback();
                onLayout?.();
              }}
              onError={() => setFailed(true)}
              style={{ width: "100%", height: "100%" }}
            />
          ) : null}
        </View>
      ) : null}
      {pending || (src && !ready && !failed) ? (
        <Txt variant="caption" tone="muted">Loading…</Txt>
      ) : failed || !src ? (
        <Txt variant="caption" tone="muted">Animation unavailable</Txt>
      ) : null}
      {src && !failed ? (
        <View style={{ position: "absolute", bottom: spacing.xs, right: spacing.xs }}>
          <IconButton size="xs" icon={requested ? Pause : Play} label={`${requested ? "Pause" : "Play"} ${name}`} disabled={!ready} onPress={() => setPlaying(!requested)} />
        </View>
      ) : null}
    </View>
  );
}
