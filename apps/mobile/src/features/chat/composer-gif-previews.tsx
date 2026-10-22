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
    {assets.map((asset, index) => <ComposerGifPreview key={asset.sourceUrl} asset={asset}
      index={index} disabled={disabled} onRetry={() => onRetry(asset.sourceUrl)} onRemove={() => onRemove(asset.sourceUrl)} />)}
  </View>;
}

function ComposerGifPreview({ asset, index, disabled, onRetry, onRemove }: {
  asset: StoredGif;
  index: number;
  disabled: boolean;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const { color } = useTheme();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const error = asset.status === "error" || (!!asset.url && failedUrl === asset.url);
  const ready = asset.status === "ready" && !error;
  const label = `GIF ${index + 1}`;
  return <View accessibilityLabel={label} accessibilityLiveRegion="polite" style={{
    minHeight: 52, borderRadius: radii.md, borderWidth: 1,
    borderColor: color(error ? "destructive" : "border"), backgroundColor: color("muted"),
    paddingLeft: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm,
  }}>
    {!ready ? error ? <ImageOff size={18} color={color("destructive")} /> : <ActivityIndicator accessibilityLabel="Preparing GIF" color={color("primary")} /> : null}
    <View style={{ minWidth: 0, flex: 1, paddingVertical: spacing.xs, gap: spacing.xs }}>
      <Txt variant="label">{error ? "Couldn't load GIF" : ready ? label : "Preparing GIF…"}</Txt>
      {error ? <Txt variant="caption" tone="muted">{gifErrorMessage(asset.error)} Retry or remove it to continue.</Txt>
        : ready ? <ChatGif key={attempt} src={asset.url} name={label} maxHeight={120} onError={() => setFailedUrl(asset.url)} />
        : <Txt variant="caption" tone="muted">Getting your preview ready.</Txt>}
      {error ? <Button title="Retry" size="sm" variant="secondary" disabled={disabled}
        onPress={() => { setFailedUrl(null); setAttempt((value) => value + 1); onRetry(); }} /> : null}
    </View>
    <IconButton icon={X} label={`Remove ${label}`} size="sm" variant="ghost" disabled={disabled} onPress={onRemove} />
  </View>;
}
