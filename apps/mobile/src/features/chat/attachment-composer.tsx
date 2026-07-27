import { ActivityIndicator, View } from "react-native";
import { FileText, Image as ImageIcon, X } from "lucide-react-native";
import { IconButton, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { formatAttachmentSize } from "./types";
import type { ManagedChatAttachment } from "./use-managed-chat-attachments";

type AttachmentComposerProps = {
  items: ManagedChatAttachment[];
  disabled: boolean;
  onRemove: (localId: string) => void;
};

export function AttachmentComposer({
  items,
  disabled,
  onRemove,
}: AttachmentComposerProps) {
  const { color } = useTheme();
  if (!items.length) return null;

  return (
    <View
      accessibilityLabel={`${items.length} selected ${items.length === 1 ? "attachment" : "attachments"}`}
      style={{ gap: spacing.xs }}
    >
      {items.map((item) => {
        const isImage = item.mimeType.startsWith("image/");
        const ItemIcon = isImage ? ImageIcon : FileText;
        const error = item.status === "error";
        const removing = item.status === "removing";
        const percent = Math.round(item.progress * 100);
        const sizeLabel = formatAttachmentSize(item.size);
        const status =
          item.status === "uploading"
            ? `Uploading ${percent}%`
            : item.status === "ready"
              ? "Ready"
              : removing
                ? "Removing"
                : (item.error ?? "Upload failed");

        return (
          <View
            key={item.localId}
            accessibilityLabel={`${item.fileName}, ${status}`}
            accessibilityLiveRegion="polite"
            style={{
              minHeight: 52,
              overflow: "hidden",
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: error ? color("destructive") : color("border"),
              backgroundColor: color("muted"),
              paddingLeft: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            {item.status === "uploading" || removing ? (
              <ActivityIndicator
                accessibilityRole="progressbar"
                color={error ? color("destructive") : color("primary")}
              />
            ) : (
              <ItemIcon
                size={18}
                color={error ? color("destructive") : color("mutedForeground")}
              />
            )}
            <View style={{ minWidth: 0, flex: 1, paddingVertical: spacing.xs }}>
              <Txt variant="label" numberOfLines={1}>
                {item.fileName}
              </Txt>
              <Txt
                variant="caption"
                tone={error ? "destructive" : "muted"}
                numberOfLines={2}
              >
                {status}
                {sizeLabel ? ` · ${sizeLabel}` : ""}
              </Txt>
              {item.status === "uploading" ? (
                <View
                  style={{
                    height: 3,
                    marginTop: spacing.xs,
                    overflow: "hidden",
                    borderRadius: radii.pill,
                    backgroundColor: color("border"),
                  }}
                >
                  <View
                    style={{
                      width: `${percent}%`,
                      height: "100%",
                      backgroundColor: color("primary"),
                    }}
                  />
                </View>
              ) : null}
            </View>
            <IconButton
              icon={X}
              label={`Remove ${item.fileName}`}
              size="sm"
              variant="ghost"
              disabled={disabled || removing}
              onPress={() => onRemove(item.localId)}
            />
          </View>
        );
      })}
    </View>
  );
}
