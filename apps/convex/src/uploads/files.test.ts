import { describe, expect, test } from "vitest";
import {
  assertCanManageClubImage,
  validateChatAttachmentMetadata,
  validateClubImageMetadata,
} from "./files";
import { NO_CLUB_PERMISSIONS } from "../clubs/rolePermissions";

describe("upload metadata validation", () => {
  test("uses stored MIME type instead of client fallback for chat attachments", () => {
    expect(() =>
      validateChatAttachmentMetadata({ contentType: "image/svg+xml", size: 1024 }),
    ).toThrow("This file type is not supported");
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

  test("rejects missing and unknown stored MIME types", () => {
    expect(() => validateChatAttachmentMetadata({ size: 512 })).toThrow(
      "This file type is not supported",
    );
    expect(() =>
      validateChatAttachmentMetadata({
        contentType: "application/octet-stream",
        size: 512,
      }),
    ).toThrow("This file type is not supported");
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

describe("club image authorization", () => {
  test("allows branding editors without membership-management permission", () => {
    expect(() =>
      assertCanManageClubImage({
        permissions: { ...NO_CLUB_PERMISSIONS, manageClubSettings: true },
        canManageMembership: false,
      }),
    ).not.toThrow();
  });

  test("rejects roles without club-settings permission", () => {
    expect(() =>
      assertCanManageClubImage({
        permissions: NO_CLUB_PERMISSIONS,
        canManageMembership: true,
      }),
    ).toThrow("You do not have permission to manage club settings");
  });
});
