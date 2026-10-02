import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { Image } from "expo-image";
import { useReducedMotion } from "react-native-reanimated";
import { Pause, Play } from "lucide-react-native";
import { IconButton, Txt } from "@/components/ui";
import { useGifAutoplay } from "@/lib/gif-playback";
import { useReduceMotion } from "@/lib/motion";
import { spacing } from "@/lib/tokens";
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
 * Long-pressing a GIF opens the message's own actions (which include Copy GIF
 * URL), so the GIF never competes with the message for the gesture.
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
  const image = useRef<Image>(null);
  const reduceMotion = useReduceMotion();
  const initialReduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(autoplay && !initialReduceMotion);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [failed, setFailed] = useState(false);
  // True while playback is paused only because the app is in the background.
  const pausedForBackground = useRef(false);
  const changePlayback = useCallback((next: boolean) => {
    setPlaying(next);
    // Before the first frame loads, the `autoplay` prop alone decides.
    if (!readyRef.current) return;
    const operation = next
      ? image.current?.startAnimating()
      : image.current?.stopAnimating();
    void operation?.catch(() => setPlaying(false));
  }, []);
  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    if (reduceMotion) changePlayback(false);
  }, [reduceMotion, changePlayback]);
  useEffect(() => {
    changePlayback(autoplay && !initialReduceMotion);
  }, [autoplay, initialReduceMotion, changePlayback]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        if (playingRef.current) {
          pausedForBackground.current = true;
          changePlayback(false);
        }
      } else if (pausedForBackground.current) {
        pausedForBackground.current = false;
        changePlayback(true);
      }
    });
    return () => subscription.remove();
  }, [changePlayback]);
  return (
    <View
      accessibilityLabel={name}
      style={{
        width: Math.min(440, 220 * aspectRatio),
        maxWidth: "100%",
      }}
    >
      {src && !failed ? (
        <Image
          ref={image}
          source={{ uri: src }}
          alt={name}
          autoplay={playing}
          contentFit="contain"
          cachePolicy="memory-disk"
          onLoad={({ source }) => {
            if (source.width > 0 && source.height > 0) {
              setAspectRatio(source.width / source.height);
            }
            readyRef.current = true;
            setReady(true);
          }}
          onError={() => setFailed(true)}
          style={{
            width: "100%",
            aspectRatio,
          }}
        />
      ) : null}
      {pending || (src && !ready && !failed) ? (
        <Txt variant="caption" tone="muted">
          Loading…
        </Txt>
      ) : failed || !src ? (
        <Txt variant="caption" tone="muted">
          Animation unavailable
        </Txt>
      ) : null}
      <View
        style={{ position: "absolute", bottom: spacing.xs, right: spacing.xs }}
      >
        {src && !failed ? (
          <IconButton
            size="xs"
            icon={playing ? Pause : Play}
            label={`${playing ? "Pause" : "Play"} ${name}`}
            disabled={!ready}
            onPress={() => {
              pausedForBackground.current = false;
              changePlayback(!playing);
            }}
          />
        ) : null}
      </View>
    </View>
  );
}
