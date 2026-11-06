import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { deleteStorageQuietly } from "../../lib/storage";
import { internalMutation, type MutationCtx } from "../_generated/server";
import {
  isSupportedStoredFileMime,
  normalizeStoredFileMime,
} from "./fileSignatures";
import {
  MAX_CHANNEL_MESSAGE_ATTACHMENTS,
  MAX_CHAT_ATTACHMENT_BYTES,
  MAX_CHAT_ATTACHMENT_FILE_NAME_CHARACTERS,
} from "../../../shared/chat/attachments";

export const STAGED_CHAT_ATTACHMENT_TTL_MS = 60 * 60 * 1000;

type StorageMetadataInput = {
  contentType?: string;
  size: number;
};

function characterCount(value: string) {
  return Array.from(value).length;
}

export function normalizeChatAttachmentFileName(fileName: string) {
  const normalized = fileName.trim().split(/[\\/]/).at(-1)?.trim() ?? "";
  if (!normalized || /[\u0000-\u001F\u007F]/.test(normalized)) {
    throw new ConvexError("File name is invalid");
  }
  if (characterCount(normalized) > MAX_CHAT_ATTACHMENT_FILE_NAME_CHARACTERS) {
    throw new ConvexError("File name is too long");
  }
  return normalized;
}

export function validateChatAttachmentMetadata(metadata: StorageMetadataInput) {
  const mimeType = normalizeStoredFileMime(
    metadata.contentType ?? "application/octet-stream",
  );
  if (!Number.isFinite(metadata.size) || metadata.size < 0) {
    throw new ConvexError("File size is invalid");
  }
  if (metadata.size > MAX_CHAT_ATTACHMENT_BYTES) {
    throw new ConvexError("File too large");
  }
  if (!isSupportedStoredFileMime(mimeType)) {
    throw new ConvexError("This file type is not supported");
  }
  return { mimeType, size: metadata.size };
}

export function assertStagedChatAttachmentIds(
  attachmentUploadIds: Id<"clubChannelAttachmentUploads">[],
) {
  if (attachmentUploadIds.length > MAX_CHANNEL_MESSAGE_ATTACHMENTS) {
    throw new ConvexError(`A message can include at most ${MAX_CHANNEL_MESSAGE_ATTACHMENTS} attachments`);
  }
  if (new Set(attachmentUploadIds).size !== attachmentUploadIds.length) {
    throw new ConvexError("An attachment can only be added once");
  }
}

export function assertStagedChatAttachmentOwner(
  attachment: Pick<Doc<"clubChannelAttachmentUploads">, "uploaderId">,
  uploaderId: Id<"users">,
) {
  if (attachment.uploaderId !== uploaderId) {
    throw new ConvexError("Attachment not found");
  }
}

export async function deleteStoredChatAttachment(
  ctx: MutationCtx,
  attachment: Pick<Doc<"clubChannelMessageAttachments">, "storageId">,
) {
  await deleteStorageQuietly(ctx, attachment.storageId);
}

export async function consumeStagedChatAttachments(
  ctx: MutationCtx,
  input: {
    attachmentUploadIds: Id<"clubChannelAttachmentUploads">[];
    uploaderId: Id<"users">;
    messageId: Id<"clubChannelMessages">;
  },
) {
  assertStagedChatAttachmentIds(input.attachmentUploadIds);

  for (const attachmentUploadId of input.attachmentUploadIds) {
    const staged = await ctx.db.get(attachmentUploadId);
    if (!staged) throw new ConvexError("Attachment not found");
    assertStagedChatAttachmentOwner(staged, input.uploaderId);

    const metadata = await ctx.db.system.get("_storage", staged.storageId);
    if (!metadata) throw new ConvexError("Attachment upload not found");
    const authoritative = validateChatAttachmentMetadata(metadata);
    if (
      authoritative.mimeType !== staged.mimeType ||
      authoritative.size !== staged.size
    ) {
      throw new ConvexError("Attachment metadata changed");
    }
    const fileUrl = await ctx.storage.getUrl(staged.storageId);
    if (!fileUrl) throw new ConvexError("Attachment upload not found");

    await ctx.db.insert("clubChannelMessageAttachments", {
      messageId: input.messageId,
      storageId: staged.storageId,
      uploaderId: staged.uploaderId,
      fileName: staged.fileName,
      fileUrl,
      mimeType: authoritative.mimeType,
      size: authoritative.size,
      createdAt: Date.now(),
    });
    await ctx.db.delete(staged._id);
  }
}

export const cleanupStagedChatAttachment = internalMutation({
  args: {
    attachmentUploadId: v.id("clubChannelAttachmentUploads"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const staged = await ctx.db.get(args.attachmentUploadId);
    if (!staged) return null;
    await deleteStorageQuietly(ctx, staged.storageId);
    await ctx.db.delete(staged._id);
    return null;
  },
});
