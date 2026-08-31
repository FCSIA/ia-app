import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { channelMessageAuditMeta, channelMessageReactionAuditMeta } from "./channels";

describe("channel message audit metadata", () => {
  test("records bounded content metadata and conversation context", () => {
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
      bodyPreview: "A complete chat message",
      bodyLength: 23,
      markdownLength: 27,
      attachmentCount: 2,
      hasPoll: true,
    });
  });

  test("bounds the table preview without duplicating the stored message", () => {
    const body = "x".repeat(300);
    const meta = channelMessageAuditMeta({
      clubId: "club" as Id<"clubs">,
      channelId: "channel" as Id<"clubChannels">,
      body,
    });

    expect(meta.bodyPreview).toHaveLength(240);
    expect(meta.bodyLength).toBe(300);
    expect(meta).not.toHaveProperty("body");
  });

  test("records a normalized reaction with its conversation context", () => {
    expect(
      channelMessageReactionAuditMeta({
        clubId: "club" as Id<"clubs">,
        channelId: "channel" as Id<"clubChannels">,
        emoji: "FIRE",
        removedReactionCount: 2,
      }),
    ).toEqual({
      clubId: "club",
      channelId: "channel",
      emoji: "FIRE",
      removedReactionCount: 2,
    });
  });
});
