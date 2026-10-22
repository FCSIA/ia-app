import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { ImageOff, X } from "lucide-react-native";
import { Button, IconButton, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { ChatGif } from "./chat-gif";
import { gifErrorMessage, type StoredGif } from "~/apps/shared/chat/stored-gifs";

export function ComposerGifPreviews({ assets, disabled, onRetry, onRemove }: {
  assets: StoredGif[];
  disabled: boolean;
  onRetry: (url: string) => void;
  onRemove: (url: string) => void;
}) {
  if (!assets.length) return null;
  return <View accessibilityLabel="GIF previews" style={{ gap: spacing.xs }}>
    {assets.map((asset) => <ComposerGifPreview key={asset.sourceUrl} asset={asset}
      disabled={disabled} onRetry={() => onRetry(asset.sourceUrl)} onRemove={() => onRemove(asset.sourceUrl)} />)}
  </View>;
}

function ComposerGifPreview({ asset, disabled, onRetry, onRemove }: {
  asset: StoredGif;
  disabled: boolean;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const { color } = useTheme();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const error = asset.status === "error" || (!!asset.url && failedUrl === asset.url);
  const ready = asset.status === "ready" && !error;
  if (ready) return <View style={{ alignSelf: "flex-start", maxWidth: "100%" }}>
    <ChatGif key={attempt} src={asset.url} name="GIF" maxHeight={120} onError={() => setFailedUrl(asset.url)} />
    <View style={{ position: "absolute", top: spacing.xs, right: spacing.xs }}>
      <IconButton icon={X} label="Remove GIF" size="sm" disabled={disabled} onPress={onRemove} />
    </View>
  </View>;
  return <View accessibilityLabel="GIF preview" accessibilityLiveRegion="polite" style={{
    minHeight: 52, borderRadius: radii.md, borderWidth: 1,
    borderColor: color(error ? "destructive" : "border"), backgroundColor: color("muted"),
    paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, gap: spacing.xs,
  }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
      {error ? <ImageOff size={18} color={color("destructive")} /> : <ActivityIndicator accessibilityLabel="Preparing GIF" color={color("primary")} />}
      <Txt variant="label" style={{ flex: 1 }}>{error ? "Couldn't load GIF" : "Preparing GIF…"}</Txt>
      <IconButton icon={X} label="Remove GIF" size="sm" variant="ghost" disabled={disabled} onPress={onRemove} />
    </View>
    <View style={{ minWidth: 0, gap: spacing.xs }}>
      {error ? <Txt variant="caption" tone="muted">{gifErrorMessage(asset.error)} Retry or remove it to continue.</Txt>
        : <Txt variant="caption" tone="muted">Getting your preview ready.</Txt>}
      {error ? <Button title="Retry" size="sm" variant="secondary" disabled={disabled}
        onPress={() => { setFailedUrl(null); setAttempt((value) => value + 1); onRetry(); }} /> : null}
    </View>
  </View>;
}
