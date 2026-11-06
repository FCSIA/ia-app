'use client';

import { useState } from 'react';
import { ConvexError } from 'convex/values';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/lib/auth';
import { useAction, useMutation } from '@/lib/convex-react';
import { uploadFileToConvex } from '@/lib/convex-upload';
import type { ClubChannelMessageRichBody } from '@/components/chat/mention-serialize';
import {
  createClientMessageIdentity,
  optimisticallyInsertPostedMessage,
} from '~/apps/shared/chat/optimistic-message';

export type SendMode = 'root' | 'thread';

export type ComposerSubmitArgs = {
  body: string;
  bodyMarkdown: string;
  bodyRich: ClubChannelMessageRichBody | null;
  parentMessageId?: Id<'clubChannelMessages'>;
  replyToMessageId?: Id<'clubChannelMessages'>;
  files: File[];
  pollQuestion?: string;
  pollOptions?: Array<{ id: string; label: string }>;
  mode: SendMode;
};

export type FailedSend = {
  channelId: Id<'clubChannels'>;
  payload: ComposerSubmitArgs;
  identity: ReturnType<typeof createClientMessageIdentity>;
  reason: string;
  retrying: boolean;
};

export type EditArgs = {
  body: string;
  bodyMarkdown: string;
  bodyRich: ClubChannelMessageRichBody | null;
  files: File[];
  removedAttachmentIds: Id<'clubChannelMessageAttachments'>[];
};

export type SendingUser = {
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  avatarUrl?: string | null;
};

function sendFailureReason(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === 'string')
    return error.data;
  if (error instanceof Error) return error.message;
  return 'Check your connection and try again.';
}

/**
 * Posting and editing share one rule for attachments: each file is uploaded
 * and staged first, and anything staged for a send that fails is discarded.
 */
function useStagedAttachments() {
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const finalizeChatAttachment = useAction(
    api.uploads.files.finalizeChatAttachment,
  );
  const discardChatAttachment = useMutation(
    api.uploads.files.discardChatAttachment,
  );
  const discardAll = (ids: Id<'clubChannelAttachmentUploads'>[]) =>
    Promise.allSettled(
      ids.map((attachmentUploadId) =>
        discardChatAttachment({ attachmentUploadId }),
      ),
    );

  return async function withStagedAttachments<T>(
    files: File[],
    use: (ids: Id<'clubChannelAttachmentUploads'>[]) => Promise<T>,
    {
      onUploaded,
      discardAfterUse = false,
    }: { onUploaded?: () => void; discardAfterUse?: boolean } = {},
  ) {
    const stagedIds: Id<'clubChannelAttachmentUploads'>[] = [];
    try {
      const uploads = await Promise.allSettled(
        files.map(async (file) => {
          const { storageId, uploadIntentId } = await uploadFileToConvex(
            {
              generateUploadUrl: () =>
                generateUploadUrl({ purpose: 'CHAT_ATTACHMENT' }),
            },
            file,
          );
          return finalizeChatAttachment({
            uploadIntentId,
            storageId,
            fileName: file.name,
          });
        }),
      );
      stagedIds.push(
        ...uploads.flatMap((result) =>
          result.status === 'fulfilled'
            ? [result.value.attachmentUploadId]
            : [],
        ),
      );
      const failure = uploads.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );
      if (failure) throw failure.reason;
      onUploaded?.();
      const result = await use(stagedIds);
      if (discardAfterUse) await discardAll(stagedIds);
      return result;
    } catch (error) {
      await discardAll(stagedIds);
      throw error;
    }
  };
}

/**
 * Sends and edits messages in one channel. A send that fails stays in
 * `failedSends` with its reason, to retry or discard.
 */
export function useChannelSend({
  clubId,
  channelId,
  user,
  onBeforeSend,
  onEdited,
}: {
  clubId: Id<'clubs'>;
  channelId: Id<'clubChannels'>;
  user: ReturnType<typeof useCurrentUser>;
  /** Runs when a fresh (not retried) message leaves the composer. */
  onBeforeSend: (mode: SendMode) => void;
  onEdited: () => void;
}) {
  const { toast } = useToast();
  const withStagedAttachments = useStagedAttachments();
  const postMessage = useMutation(
    api.clubs.channels.postMessage,
  ).withOptimisticUpdate((localStore, args) => {
    if (!user) return;
    optimisticallyInsertPostedMessage(localStore, args, {
      clubId,
      author: user,
    });
  });
  const updateMessage = useMutation(api.clubs.channels.updateMessage);
  const [sendingMode, setSendingMode] = useState<SendMode | null>(null);
  const [savingEditId, setSavingEditId] =
    useState<Id<'clubChannelMessages'> | null>(null);
  const [failedSends, setFailedSends] = useState<FailedSend[]>([]);

  const saveEdit = async (
    messageId: Id<'clubChannelMessages'>,
    { body, bodyMarkdown, bodyRich, files, removedAttachmentIds }: EditArgs,
  ) => {
    setSavingEditId(messageId);
    try {
      await withStagedAttachments(files, (stagedIds) =>
        updateMessage({
          messageId,
          body,
          bodyMarkdown: bodyMarkdown.trim() || undefined,
          bodyRich: bodyRich ?? undefined,
          addAttachments: stagedIds.length ? stagedIds : undefined,
          removeAttachmentIds: removedAttachmentIds.length
            ? removedAttachmentIds
            : undefined,
        }),
      );
      onEdited();
    } catch {
      toast({ title: "Couldn't save your changes", variant: 'destructive' });
    } finally {
      setSavingEditId(null);
    }
  };

  const submitMessage = async (
    payload: ComposerSubmitArgs,
    retryIdentity?: FailedSend['identity'],
  ) => {
    const {
      body,
      bodyMarkdown,
      bodyRich,
      parentMessageId,
      replyToMessageId,
      files,
      pollQuestion,
      pollOptions,
      mode,
    } = payload;
    const identity = retryIdentity ?? createClientMessageIdentity();
    const destinationChannelId = channelId;
    if (!retryIdentity) onBeforeSend(mode);
    setFailedSends((current) =>
      current.map((item) =>
        item.identity.clientGeneratedId === identity.clientGeneratedId
          ? { ...item, retrying: true }
          : item,
      ),
    );
    if (files.length) setSendingMode(mode);
    try {
      await withStagedAttachments(
        files,
        (attachmentUploadIds) =>
          postMessage({
            channelId: destinationChannelId,
            body: body.trim(),
            bodyMarkdown: bodyMarkdown.trim() || undefined,
            bodyRich: body.trim() ? (bodyRich ?? undefined) : undefined,
            parentMessageId,
            replyToMessageId,
            pollQuestion,
            pollOptions,
            attachments: attachmentUploadIds,
            ...identity,
          }),
        {
          onUploaded: () => {
            if (files.length) setSendingMode(null);
          },
          discardAfterUse: true,
        },
      );
      setFailedSends((current) =>
        current.filter(
          (item) =>
            item.identity.clientGeneratedId !== identity.clientGeneratedId,
        ),
      );
    } catch (error) {
      setFailedSends((current) => [
        ...current.filter(
          (item) =>
            item.identity.clientGeneratedId !== identity.clientGeneratedId,
        ),
        {
          channelId: destinationChannelId,
          payload,
          identity,
          reason: sendFailureReason(error),
          retrying: false,
        },
      ]);
    } finally {
      if (files.length) setSendingMode(null);
    }
  };

  return {
    sendingMode,
    savingEditId,
    failedSends,
    saveEdit,
    submitMessage,
    discardFailedSend: (item: FailedSend) =>
      setFailedSends((current) => current.filter((entry) => entry !== item)),
    resetSending: () => setSendingMode(null),
  };
}
