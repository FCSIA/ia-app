import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { Image } from "expo-image";
import { useReducedMotion } from "react-native-reanimated";
import { Pause, Play } from "lucide-react-native";
import { IconButton, Txt } from "@/components/ui";
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

export function ChatGif({
  src,
  name,
  pending = false,
}: {
  src: string | null;
  name: string;
  pending?: boolean;
}) {
  const image = useRef<Image>(null);
  const reduceMotion = useReduceMotion();
  const initialReduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(!initialReduceMotion);
  const [ready, setReady] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [failed, setFailed] = useState(false);
  const changePlayback = useCallback((next: boolean) => {
    const operation = next
      ? image.current?.startAnimating()
      : image.current?.stopAnimating();
    setPlaying(next);
    void operation?.catch(() => {
      setPlaying(false);
      setFailed(true);
    });
  }, []);
  useEffect(() => {
    if (reduceMotion) changePlayback(false);
  }, [reduceMotion, changePlayback]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") changePlayback(false);
    });
    return () => subscription.remove();
  }, [changePlayback]);
  return (
    <View
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
            onPress={() => changePlayback(!playing)}
          />
        ) : null}
      </View>
    </View>
  );
}
