import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import {
  assertStagedChatAttachmentIds,
  assertStagedChatAttachmentOwner,
  normalizeChatAttachmentFileName,
} from "./chatAttachments";

describe("staged club chat attachments", () => {
  test("normalizes a portable file name", () => {
    expect(normalizeChatAttachmentFileName(" C:\\fakepath\\agenda.pdf ")).toBe(
      "agenda.pdf",
    );
    expect(() => normalizeChatAttachmentFileName("bad\u0000name.pdf")).toThrow(
      "File name is invalid",
    );
  });

  test("bounds and deduplicates attachment stage ids", () => {
    const ids = Array.from(
      { length: 5 },
      (_, index) => `upload-${index}` as Id<"clubChannelAttachmentUploads">,
    );
    expect(() => assertStagedChatAttachmentIds(ids)).not.toThrow();
    expect(() => assertStagedChatAttachmentIds([...ids, ids[0]])).toThrow(
      "A message can include at most 5 attachments",
    );
    expect(() => assertStagedChatAttachmentIds([ids[0], ids[0]])).toThrow(
      "An attachment can only be added once",
    );
  });

  test("requires the message author to own every stage", () => {
    const ownerId = "owner" as Id<"users">;
    expect(() =>
      assertStagedChatAttachmentOwner({ uploaderId: ownerId }, ownerId),
    ).not.toThrow();
    expect(() =>
      assertStagedChatAttachmentOwner(
        { uploaderId: "other" as Id<"users"> },
        ownerId,
      ),
    ).toThrow("Attachment not found");
  });
});
