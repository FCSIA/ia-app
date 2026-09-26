import { useEffect, useRef, useState } from "react";
import { AppState, Linking, View } from "react-native";
import { Image } from "expo-image";
import { Pause, Play } from "lucide-react-native";
import { Button, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { useReduceMotion } from "@/lib/motion";
import { spacing } from "@/lib/tokens";
import { useAction } from "@/lib/convex-react";
import { api } from "~/apps/convex/src/_generated/api";
import { extractChatGifLinks, type ChatGifLink } from "~/apps/shared/chat/gifs";

export function ChatGifLinks({ text }: { text: string }) {
  return extractChatGifLinks(text).map((link) => (
    <LinkedChatGif key={link.url} link={link} />
  ));
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
      href={link.url}
      name="GIF"
      pending={!link.mediaUrl && resolved?.url !== link.url}
    />
  );
}

export function ChatGif({
  src,
  href,
  name,
  pending = false,
}: {
  src: string | null;
  href: string;
  name: string;
  pending?: boolean;
}) {
  const image = useRef<Image>(null);
  const { color } = useTheme();
  const reduceMotion = useReduceMotion();
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const operation = playing
      ? image.current?.startAnimating()
      : image.current?.stopAnimating();
    void operation?.catch(() => {
      setPlaying(false);
      setFailed(true);
    });
  }, [playing, ready]);
  useEffect(() => {
    if (reduceMotion) setPlaying(false);
  }, [reduceMotion]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") setPlaying(false);
    });
    return () => subscription.remove();
  }, []);
  return (
    <View
      style={{
        width: "100%",
        maxWidth: 440,
        gap: spacing.xs,
        paddingTop: spacing.xs,
      }}
    >
      {src && !failed ? (
        <Image
          ref={image}
          source={{ uri: src }}
          alt={name}
          autoplay={false}
          contentFit="contain"
          cachePolicy="memory-disk"
          onLoad={() => setReady(true)}
          onError={() => setFailed(true)}
          style={{
            width: "100%",
            height: 220,
            backgroundColor: color("muted"),
          }}
        />
      ) : null}
      <Txt variant="caption" tone="muted">
        {pending || (src && !ready && !failed)
          ? "Loading GIF…"
          : failed || !src
            ? "GIF preview unavailable"
            : playing
              ? "Playing GIF"
              : "GIF paused"}
      </Txt>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {src && !failed ? (
          <Button
            size="sm"
            variant="secondary"
            title={playing ? "Pause" : "Play"}
            icon={playing ? Pause : Play}
            accessibilityLabel={`${playing ? "Pause" : "Play"} ${name}`}
            disabled={!ready}
            onPress={() => setPlaying(!playing)}
          />
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          title="Open GIF"
          onPress={() => {
            void Linking.openURL(href).catch(() => setFailed(true));
          }}
        />
      </View>
    </View>
  );
}
