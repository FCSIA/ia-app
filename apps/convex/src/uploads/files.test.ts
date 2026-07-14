import { describe, expect, test } from "vitest";
import {
  validateChatAttachmentMetadata,
  validateClubImageMetadata,
} from "./files";

describe("upload metadata validation", () => {
  test("uses stored MIME type instead of client fallback for chat attachments", () => {
    expect(() =>
      validateChatAttachmentMetadata({ contentType: "image/svg+xml", size: 1024 }),
    ).toThrow("This file type is not allowed");
  });

  test("rejects oversized chat attachments from stored metadata", () => {
    expect(() =>
      validateChatAttachmentMetadata({
        contentType: "application/pdf",
        size: 10 * 1024 * 1024 + 1,
      }),
    ).toThrow("File too large");
  });

  test("accepts safe chat attachment metadata", () => {
    expect(
      validateChatAttachmentMetadata({ contentType: "application/pdf", size: 2048 }),
    ).toEqual({ mimeType: "application/pdf", size: 2048 });
  });

  test("uses a safe generic MIME type when storage has none", () => {
    expect(validateChatAttachmentMetadata({ size: 512 })).toEqual({
      mimeType: "application/octet-stream",
      size: 512,
    });
  });

  test("only allows raster club images", () => {
    expect(() =>
      validateClubImageMetadata(
        { contentType: "image/svg+xml", size: 1024 },
        "image/svg+xml",
      ),
    ).toThrow("Only image uploads are allowed");

    expect(
      validateClubImageMetadata(
        { contentType: "IMAGE/WEBP", size: 1024 },
        "application/octet-stream",
      ),
    ).toEqual({ mimeType: "image/webp", size: 1024 });
  });
});
