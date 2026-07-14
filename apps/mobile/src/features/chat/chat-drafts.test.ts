import { describe, expect, test } from "vitest";
import {
  CHAT_DRAFT_TTL_MS,
  chatDraftKey,
  parseChatDraft,
  serializeChatDraft,
  shouldRestoreChatDraft,
  type ChatDraftIdentity,
} from "./chat-drafts";

const identity: ChatDraftIdentity = {
  userId: "user-1",
  clubId: "club-1",
  channelId: "channel-1",
  threadId: "thread-1",
};

describe("mobile chat drafts", () => {
  test("isolates keys and payloads by user and thread identity", () => {
    expect(chatDraftKey(identity)).not.toBe(
      chatDraftKey({ ...identity, userId: "user-2" }),
    );
    expect(
      parseChatDraft(
        serializeChatDraft(identity, "Hello", "**Hello**", 100),
        identity,
        101,
      ),
    ).toMatchObject({
      plainText: "Hello",
      markdown: "**Hello**",
    });
    expect(
      parseChatDraft(
        serializeChatDraft(identity, "Hello", "Hello", 100),
        { ...identity, threadId: null },
        101,
      ),
    ).toBeNull();
  });

  test("drops malformed, future, and expired records", () => {
    expect(parseChatDraft("not-json", identity, 100)).toBeNull();
    expect(
      parseChatDraft(
        serializeChatDraft(identity, "a", "a", 101),
        identity,
        100,
      ),
    ).toBeNull();
    expect(
      parseChatDraft(
        serializeChatDraft(identity, "a", "a", 100),
        identity,
        100 + CHAT_DRAFT_TTL_MS + 1,
      ),
    ).toBeNull();
  });

  test("does not restore a late read after typing or navigation", () => {
    expect(
      shouldRestoreChatDraft({
        keyAtReadStart: "key",
        activeKey: "key",
        revisionAtReadStart: 2,
        activeRevision: 3,
      }),
    ).toBe(false);
    expect(
      shouldRestoreChatDraft({
        keyAtReadStart: "old-key",
        activeKey: "new-key",
        revisionAtReadStart: 2,
        activeRevision: 2,
      }),
    ).toBe(false);
  });
});
