import { describe, expect, test } from "vitest";
import {
  validateChatAttachmentMetadata,
  validateClubImageMetadata,
} from "./files";

describe("upload metadata validation", () => {
  test("uses stored MIME type instead of client fallback for chat attachments", () => {
    expect(() =>
      validateChatAttachmentMetadata(
        { contentType: "image/svg+xml", size: 1024 },
        "image/png",
      ),
    ).toThrow("This file type is not allowed");
  });

  test("rejects oversized chat attachments from stored metadata", () => {
    expect(() =>
      validateChatAttachmentMetadata(
        { contentType: "application/pdf", size: 10 * 1024 * 1024 + 1 },
        "application/pdf",
      ),
    ).toThrow("File too large");
  });

  test("accepts safe chat attachment metadata", () => {
    expect(
      validateChatAttachmentMetadata(
        { contentType: "application/pdf", size: 2048 },
        "application/octet-stream",
      ),
    ).toEqual({ mimeType: "application/pdf", size: 2048 });
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
