import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import { File, type UploadTask } from "expo-file-system";
import { useMutation } from "convex/react";
import { useToast } from "@/components/ui";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import {
  MAX_CHAT_ATTACHMENTS,
  normalizedMimeType,
  parseConvexStorageId,
  validatePickedChatAttachment,
} from "./chat-attachments";

export type ManagedChatAttachment = {
  localId: string;
  fileName: string;
  mimeType: string;
  size: number;
  status: "uploading" | "ready" | "removing" | "error";
  progress: number;
  attachmentUploadId?: Id<"clubChannelAttachmentUploads">;
  error?: string;
};

type ItemUpdater = (
  current: ManagedChatAttachment[],
) => ManagedChatAttachment[];

export function useManagedChatAttachments() {
  const { showToast } = useToast();
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const finalizeAttachment = useMutation(
    api.uploads.files.finalizeChatAttachment,
  );
  const discardAttachment = useMutation(
    api.uploads.files.discardChatAttachment,
  );
  const [items, setItems] = useState<ManagedChatAttachment[]>([]);
  const [pickerBusy, setPickerBusy] = useState(false);
  const pickerBusyRef = useRef(false);
  const itemsRef = useRef<ManagedChatAttachment[]>([]);
  const uploadTasksRef = useRef(new Map<string, UploadTask>());
  const sequenceRef = useRef(0);
  const generationRef = useRef(0);
  const disposedRef = useRef(false);
  const discardAttachmentRef = useRef(discardAttachment);
  discardAttachmentRef.current = discardAttachment;

  const updateItems = useCallback((updater: ItemUpdater) => {
    const next = updater(itemsRef.current);
    itemsRef.current = next;
    if (!disposedRef.current) setItems(next);
    return next;
  }, []);

  const discardIds = useCallback(
    async (attachmentUploadIds: Id<"clubChannelAttachmentUploads">[]) => {
      await Promise.allSettled(
        attachmentUploadIds.map((attachmentUploadId) =>
          discardAttachment({ attachmentUploadId }),
        ),
      );
    },
    [discardAttachment],
  );

  const uploadOne = useCallback(
    async (
      item: ManagedChatAttachment,
      file: File,
      generationAtStart: number,
    ) => {
      let task: UploadTask | undefined;
      let stagedId: Id<"clubChannelAttachmentUploads"> | undefined;
      try {
        const uploadUrl = await generateUploadUrl({});
        if (
          generationRef.current !== generationAtStart ||
          !itemsRef.current.some((entry) => entry.localId === item.localId)
        ) {
          return;
        }

        task = file.createUploadTask(uploadUrl, {
          httpMethod: "POST",
          headers: { "Content-Type": item.mimeType },
          mimeType: item.mimeType,
          sessionType: "foreground",
          onProgress: ({ bytesSent, totalBytes }) => {
            const total = totalBytes > 0 ? totalBytes : item.size;
            const progress = total > 0 ? bytesSent / total : 0;
            updateItems((current) =>
              current.map((entry) =>
                entry.localId === item.localId && entry.status === "uploading"
                  ? {
                      ...entry,
                      progress: Math.max(0, Math.min(0.99, progress)),
                    }
                  : entry,
              ),
            );
          },
        });
        uploadTasksRef.current.set(item.localId, task);
        const result = await task.uploadAsync();
        if (result.status < 200 || result.status >= 300) {
          throw new Error("The file upload was not accepted.");
        }
        const rawStorageId = parseConvexStorageId(result.body);
        if (!rawStorageId) {
          throw new Error("The upload response was incomplete.");
        }

        // Finalizing gives the server ownership of validation and lets any
        // abandoned upload be deleted through the staged-upload API.
        const finalized = await finalizeAttachment({
          storageId: rawStorageId as Id<"_storage">,
          fileName: item.fileName,
        });
        stagedId = finalized.attachmentUploadId;

        if (
          disposedRef.current ||
          generationRef.current !== generationAtStart ||
          !itemsRef.current.some((entry) => entry.localId === item.localId)
        ) {
          await discardAttachment({ attachmentUploadId: stagedId }).catch(
            () => {},
          );
          return;
        }

        updateItems((current) =>
          current.map((entry) =>
            entry.localId === item.localId
              ? {
                  ...entry,
                  fileName: finalized.fileName,
                  mimeType: finalized.mimeType,
                  size: finalized.size,
                  status: "ready",
                  progress: 1,
                  attachmentUploadId: finalized.attachmentUploadId,
                  error: undefined,
                }
              : entry,
          ),
        );
      } catch (error) {
        if (stagedId) {
          await discardAttachment({ attachmentUploadId: stagedId }).catch(
            () => {},
          );
        }
        updateItems((current) =>
          current.map((entry) =>
            entry.localId === item.localId
              ? {
                  ...entry,
                  status: "error",
                  progress: 0,
                  error: attachmentUploadError(error),
                }
              : entry,
          ),
        );
      } finally {
        uploadTasksRef.current.delete(item.localId);
        task?.release();
      }
    },
    [discardAttachment, finalizeAttachment, generateUploadUrl, updateItems],
  );

  const pickAttachments = useCallback(async () => {
    if (pickerBusyRef.current) return;
    const remaining = MAX_CHAT_ATTACHMENTS - itemsRef.current.length;
    if (remaining <= 0) {
      showToast({
        title: "Attachment limit reached",
        body: "A message can include up to 5 files.",
        tone: "warning",
      });
      return;
    }

    const generationAtPickStart = generationRef.current;
    pickerBusyRef.current = true;
    setPickerBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled) return;
      if (
        disposedRef.current ||
        generationRef.current !== generationAtPickStart
      ) {
        return;
      }

      const selected = result.assets.slice(0, remaining);
      if (result.assets.length > selected.length) {
        showToast({
          title: "Some files were not added",
          body: "A message can include up to 5 files.",
          tone: "warning",
        });
      }

      const prepared = selected.map((asset) => {
        const localId = `attachment-${Date.now()}-${++sequenceRef.current}`;
        try {
          const file = new File(asset.uri);
          if (!file.exists)
            throw new Error("The selected file is unavailable.");
          const mimeType = normalizedMimeType(
            asset.mimeType || file.type || undefined,
          );
          const size = Number.isFinite(file.size)
            ? file.size
            : (asset.size ?? -1);
          const validationError = validatePickedChatAttachment({
            fileName: asset.name,
            mimeType,
            size,
          });
          const item: ManagedChatAttachment = {
            localId,
            fileName: asset.name,
            mimeType,
            size,
            status: validationError ? "error" : "uploading",
            progress: 0,
            error: validationError ?? undefined,
          };
          return { item, file: validationError ? null : file };
        } catch (error) {
          const item: ManagedChatAttachment = {
            localId,
            fileName: asset.name,
            mimeType: normalizedMimeType(asset.mimeType),
            size: asset.size ?? -1,
            status: "error",
            progress: 0,
            error: attachmentUploadError(error),
          };
          return { item, file: null };
        }
      });

      updateItems((current) => [
        ...current,
        ...prepared.map(({ item }) => item),
      ]);
      for (const { item, file } of prepared) {
        if (file) void uploadOne(item, file, generationAtPickStart);
      }
    } catch (error) {
      showToast({
        title: "Files could not be selected",
        body: attachmentUploadError(error),
        tone: "warning",
      });
    } finally {
      pickerBusyRef.current = false;
      if (!disposedRef.current) setPickerBusy(false);
    }
  }, [showToast, updateItems, uploadOne]);

  const removeAttachment = useCallback(
    async (localId: string) => {
      const item = itemsRef.current.find((entry) => entry.localId === localId);
      if (!item) return;
      uploadTasksRef.current.get(localId)?.cancel();

      if (!item.attachmentUploadId) {
        updateItems((current) =>
          current.filter((entry) => entry.localId !== localId),
        );
        return;
      }

      updateItems((current) =>
        current.map((entry) =>
          entry.localId === localId ? { ...entry, status: "removing" } : entry,
        ),
      );
      try {
        await discardAttachment({
          attachmentUploadId: item.attachmentUploadId,
        });
      } catch {
        showToast({
          title: "Attachment removed",
          body: "Server cleanup will finish automatically.",
          tone: "warning",
        });
      } finally {
        updateItems((current) =>
          current.filter((entry) => entry.localId !== localId),
        );
      }
    },
    [discardAttachment, showToast, updateItems],
  );

  const abandonAttachments = useCallback(async () => {
    generationRef.current += 1;
    for (const task of uploadTasksRef.current.values()) task.cancel();
    const attachmentUploadIds = itemsRef.current.flatMap((item) =>
      item.attachmentUploadId ? [item.attachmentUploadId] : [],
    );
    updateItems(() => []);
    await discardIds(attachmentUploadIds);
  }, [discardIds, updateItems]);

  const markAttachmentsConsumed = useCallback(() => {
    generationRef.current += 1;
    updateItems(() => []);
  }, [updateItems]);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      generationRef.current += 1;
      for (const task of uploadTasksRef.current.values()) task.cancel();
      const attachmentUploadIds = itemsRef.current.flatMap((item) =>
        item.attachmentUploadId ? [item.attachmentUploadId] : [],
      );
      itemsRef.current = [];
      void Promise.allSettled(
        attachmentUploadIds.map((attachmentUploadId) =>
          discardAttachmentRef.current({ attachmentUploadId }),
        ),
      );
    };
  }, []);

  const readyAttachmentUploadIds = useMemo(
    () =>
      items.flatMap((item) =>
        item.status === "ready" && item.attachmentUploadId
          ? [item.attachmentUploadId]
          : [],
      ),
    [items],
  );
  const attachmentSubmissionBlocked =
    pickerBusy || items.some((item) => item.status !== "ready");

  return {
    items,
    pickerBusy,
    canPickAttachments: !pickerBusy && items.length < MAX_CHAT_ATTACHMENTS,
    readyAttachmentUploadIds,
    hasReadyAttachments: readyAttachmentUploadIds.length > 0,
    attachmentSubmissionBlocked,
    pickAttachments,
    removeAttachment,
    abandonAttachments,
    markAttachmentsConsumed,
  };
}

function attachmentUploadError(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "Upload canceled.";
    if (error.message.trim()) return error.message;
  }
  return "Check your connection and try again.";
}
