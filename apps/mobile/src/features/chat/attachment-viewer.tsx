import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, View } from "react-native";
import { Image } from "expo-image";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { ExternalLink, FileText, Share2 } from "lucide-react-native";
import { Button, Sheet, Txt, useToast } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import {
  attachmentCacheFileName,
  safeRemoteAttachmentUrl,
  validatePickedChatAttachment,
} from "./chat-attachments";
import {
  formatAttachmentSize,
  isImageAttachment,
  type ChatAttachment,
} from "./types";

type AttachmentViewerProps = {
  attachment: ChatAttachment | null;
  onClose: () => void;
};

export function AttachmentViewer({
  attachment,
  onClose,
}: AttachmentViewerProps) {
  const { color } = useTheme();
  const { showToast } = useToast();
  const [sharing, setSharing] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const downloadAbortRef = useRef<AbortController | null>(null);
  const safeUrl = attachment
    ? safeRemoteAttachmentUrl(attachment.fileUrl)
    : null;
  const safetyError = attachment
    ? validatePickedChatAttachment({
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size ?? 0,
      })
    : null;
  const canUseAttachment = !!attachment && !!safeUrl && !safetyError;
  const image = !!attachment && isImageAttachment(attachment);
  const sizeLabel = formatAttachmentSize(attachment?.size);

  useEffect(() => {
    downloadAbortRef.current?.abort();
    downloadAbortRef.current = null;
    setSharing(false);
    setDownloadProgress(null);
    setImageFailed(false);
    return () => downloadAbortRef.current?.abort();
  }, [attachment?._id]);

  const detail = useMemo(() => {
    if (!attachment) return null;
    return [attachment.mimeType, sizeLabel].filter(Boolean).join(" · ");
  }, [attachment, sizeLabel]);

  async function openExternally() {
    if (!safeUrl || safetyError) {
      showToast({
        title: "Attachment cannot be opened safely",
        body: safetyError ?? "The file link is invalid.",
        tone: "warning",
      });
      return;
    }
    try {
      const supported = await Linking.canOpenURL(safeUrl);
      if (!supported) throw new Error("No app can open this attachment.");
      await Linking.openURL(safeUrl);
    } catch (error) {
      showToast({
        title: "Attachment could not be opened",
        body: viewerError(error),
        tone: "warning",
      });
    }
  }

  async function shareAttachment() {
    if (!attachment || !safeUrl || safetyError || sharing) return;
    let downloaded: File | null = null;
    setSharing(true);
    setDownloadProgress(0);
    const abortController = new AbortController();
    downloadAbortRef.current = abortController;
    try {
      if (!(await Sharing.isAvailableAsync())) {
        await openExternally();
        return;
      }
      const destination = new File(
        Paths.cache,
        attachmentCacheFileName(attachment.fileName, attachment._id),
      );
      downloaded = await File.downloadFileAsync(safeUrl, destination, {
        idempotent: true,
        signal: abortController.signal,
        onProgress: ({ bytesWritten, totalBytes }) => {
          if (totalBytes > 0) {
            setDownloadProgress(
              Math.max(0, Math.min(1, bytesWritten / totalBytes)),
            );
          }
        },
      });
      await Sharing.shareAsync(downloaded.uri, {
        dialogTitle: `Share ${attachment.fileName}`,
        mimeType: attachment.mimeType,
      });
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        showToast({
          title: "Attachment could not be shared",
          body: viewerError(error),
          tone: "warning",
        });
      }
    } finally {
      try {
        if (downloaded?.exists) downloaded.delete();
      } catch {
        // Cached shares are safe to remove on the operating system's schedule.
      }
      setSharing(false);
      setDownloadProgress(null);
      if (downloadAbortRef.current === abortController) {
        downloadAbortRef.current = null;
      }
    }
  }

  function closeViewer() {
    downloadAbortRef.current?.abort();
    onClose();
  }

  return (
    <Sheet
      open={!!attachment}
      onClose={closeViewer}
      title={attachment?.fileName ?? "Attachment"}
      scrollable
    >
      {attachment ? (
        <>
          {image && canUseAttachment && !imageFailed ? (
            <View
              style={{
                height: 280,
                overflow: "hidden",
                borderRadius: radii.lg,
                backgroundColor: color("muted"),
              }}
            >
              <Image
                source={{ uri: safeUrl! }}
                alt={attachment.fileName}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={160}
                onError={() => setImageFailed(true)}
                style={{ width: "100%", height: "100%" }}
              />
            </View>
          ) : (
            <View
              style={{
                minHeight: 144,
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: safetyError
                  ? color("destructive")
                  : color("border"),
                backgroundColor: color("muted"),
                alignItems: "center",
                justifyContent: "center",
                padding: spacing.lg,
                gap: spacing.sm,
              }}
            >
              <FileText
                size={34}
                color={
                  safetyError ? color("destructive") : color("mutedForeground")
                }
              />
              <Txt
                variant="label"
                numberOfLines={2}
                style={{ textAlign: "center" }}
              >
                {attachment.fileName}
              </Txt>
              {imageFailed ? (
                <Txt
                  variant="caption"
                  tone="muted"
                  style={{ textAlign: "center" }}
                >
                  The image preview is unavailable. You can still open or share
                  the original file.
                </Txt>
              ) : null}
            </View>
          )}

          {detail ? (
            <Txt variant="caption" tone="muted">
              {detail}
            </Txt>
          ) : null}
          {safetyError || !safeUrl ? (
            <Txt variant="caption" tone="destructive">
              {safetyError ?? "This attachment has an invalid file link."}
            </Txt>
          ) : null}
          {sharing && downloadProgress !== null ? (
            <Txt
              accessibilityLiveRegion="polite"
              variant="caption"
              tone="muted"
            >
              Preparing share… {Math.round(downloadProgress * 100)}%
            </Txt>
          ) : null}

          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
          >
            <Button
              title="Share"
              icon={Share2}
              variant="secondary"
              loading={sharing}
              disabled={!canUseAttachment}
              onPress={() => void shareAttachment()}
              style={{ flexGrow: 1 }}
            />
            <Button
              title="Open"
              icon={ExternalLink}
              variant="tertiary"
              disabled={!canUseAttachment || sharing}
              onPress={() => void openExternally()}
              style={{ flexGrow: 1 }}
            />
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

function viewerError(error: unknown) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "Check your connection and try again.";
}
