import { describe, expect, test } from "vitest";
import {
  MAX_CHAT_ATTACHMENT_BYTES,
  attachmentCacheFileName,
  parseConvexStorageId,
  safeRemoteAttachmentUrl,
  validatePickedChatAttachment,
} from "./chat-attachments";

describe("mobile managed chat attachments", () => {
  test("validates size, names, and active content before upload", () => {
    expect(
      validatePickedChatAttachment({
        fileName: "schedule.pdf",
        mimeType: "application/pdf",
        size: MAX_CHAT_ATTACHMENT_BYTES,
      }),
    ).toBeNull();
    expect(
      validatePickedChatAttachment({
        fileName: "too-large.pdf",
        mimeType: "application/pdf",
        size: MAX_CHAT_ATTACHMENT_BYTES + 1,
      }),
    ).toMatch("10 MB");
    expect(
      validatePickedChatAttachment({
        fileName: "folder/report.pdf",
        mimeType: "application/pdf",
        size: 10,
      }),
    ).toMatch("invalid name");
    expect(
      validatePickedChatAttachment({
        fileName: "page.html",
        mimeType: "application/octet-stream",
        size: 10,
      }),
    ).toMatch("not allowed");
  });

  test("only accepts credential-free HTTPS attachment URLs", () => {
    expect(
      safeRemoteAttachmentUrl("https://files.example.edu/report.pdf"),
    ).toBe("https://files.example.edu/report.pdf");
    expect(safeRemoteAttachmentUrl("http://files.example.edu/a")).toBeNull();
    expect(
      safeRemoteAttachmentUrl("https://student:secret@example.edu/a"),
    ).toBeNull();
    expect(safeRemoteAttachmentUrl("javascript:alert(1)")).toBeNull();
  });

  test("parses upload responses and creates traversal-safe cache names", () => {
    expect(parseConvexStorageId('{"storageId":"kg2abc"}')).toBe("kg2abc");
    expect(parseConvexStorageId("not-json")).toBeNull();
    expect(attachmentCacheFileName("report.PDF", "id/../../unsafe")).toBe(
      "ia-chat-idunsafe.pdf",
    );
    expect(attachmentCacheFileName("page.html", "id-1")).toBe("ia-chat-id-1");
  });
});
