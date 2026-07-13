export const CHAT_DRAFT_VERSION = 1;
export const CHAT_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export type ChatDraftIdentity = {
  userId: string;
  clubId: string;
  channelId: string;
  threadId?: string | null;
};

export type StoredChatDraft = {
  version: typeof CHAT_DRAFT_VERSION;
  identity: ChatDraftIdentity;
  plainText: string;
  markdown: string;
  updatedAt: number;
};

function draftPart(value: string) {
  return encodeURIComponent(value);
}

export function chatDraftKey(identity: ChatDraftIdentity) {
  return [
    "ia_chat_draft",
    CHAT_DRAFT_VERSION,
    draftPart(identity.userId),
    draftPart(identity.clubId),
    draftPart(identity.channelId),
    draftPart(identity.threadId || "root"),
  ].join(":");
}

export function serializeChatDraft(
  identity: ChatDraftIdentity,
  plainText: string,
  markdown: string,
  updatedAt = Date.now(),
) {
  return JSON.stringify({
    version: CHAT_DRAFT_VERSION,
    identity,
    plainText,
    markdown,
    updatedAt,
  } satisfies StoredChatDraft);
}

export function parseChatDraft(
  raw: string | null,
  expectedIdentity: ChatDraftIdentity,
  now = Date.now(),
): StoredChatDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredChatDraft>;
    const identity = value.identity;
    if (
      value.version !== CHAT_DRAFT_VERSION ||
      !identity ||
      identity.userId !== expectedIdentity.userId ||
      identity.clubId !== expectedIdentity.clubId ||
      identity.channelId !== expectedIdentity.channelId ||
      (identity.threadId || null) !== (expectedIdentity.threadId || null) ||
      typeof value.plainText !== "string" ||
      typeof value.markdown !== "string" ||
      typeof value.updatedAt !== "number" ||
      value.updatedAt > now ||
      now - value.updatedAt > CHAT_DRAFT_TTL_MS
    ) {
      return null;
    }
    return value as StoredChatDraft;
  } catch {
    return null;
  }
}

export function shouldRestoreChatDraft({
  keyAtReadStart,
  activeKey,
  revisionAtReadStart,
  activeRevision,
}: {
  keyAtReadStart: string;
  activeKey: string | null;
  revisionAtReadStart: number;
  activeRevision: number;
}) {
  return keyAtReadStart === activeKey && revisionAtReadStart === activeRevision;
}
