import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { channelMessageAuditMeta } from "./channels";

describe("channel message audit metadata", () => {
  test("records the canonical text and conversation context", () => {
    const meta = channelMessageAuditMeta({
      clubId: "club" as Id<"clubs">,
      channelId: "channel" as Id<"clubChannels">,
      body: "A complete chat message",
      bodyMarkdown: "**A complete chat message**",
      parentMessageId: "parent" as Id<"clubChannelMessages">,
      attachmentCount: 2,
      hasPoll: true,
    });

    expect(meta).toEqual({
      clubId: "club",
      channelId: "channel",
      parentMessageId: "parent",
      replyToMessageId: null,
      body: "A complete chat message",
      bodyPreview: "A complete chat message",
      bodyMarkdown: "**A complete chat message**",
      attachmentCount: 2,
      hasPoll: true,
    });
  });

  test("bounds the table preview without truncating the stored message", () => {
    const body = "x".repeat(300);
    const meta = channelMessageAuditMeta({
      clubId: "club" as Id<"clubs">,
      channelId: "channel" as Id<"clubChannels">,
      body,
    });

    expect(meta.body).toHaveLength(300);
    expect(meta.bodyPreview).toHaveLength(240);
  });
});
