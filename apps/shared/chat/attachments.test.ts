import { describe, expect, test } from "vitest";
import { formatAttachmentSize, isImageAttachment, isPdfAttachment } from "./attachments";

describe("chat attachment kinds", () => {
  test("renders GIFs as images even when legacy MIME metadata is absent", () => {
    const attachment = { fileName: "dance.GIF", fileUrl: "https://files.example.edu/gif" };
    expect(isImageAttachment(attachment)).toBe(true);
    expect(isImageAttachment({ ...attachment, mimeType: "application/octet-stream" })).toBe(true);
    expect(isImageAttachment({ ...attachment, mimeType: "IMAGE/GIF" })).toBe(true);
    expect(isImageAttachment({ ...attachment, mimeType: "image/svg+xml" })).toBe(false);
  });

  test("recognizes PDFs from either MIME metadata or the file name", () => {
    expect(isPdfAttachment({ fileName: "student-handbook", mimeType: "application/pdf; charset=binary" })).toBe(true);
    expect(isPdfAttachment({ fileName: "permission-form.PDF" })).toBe(true);
    expect(isPdfAttachment({ fileName: "notes.txt" })).toBe(false);
  });

  test("formats sizes and leaves unknown sizes out", () => {
    expect(formatAttachmentSize(512)).toBe("512 B");
    expect(formatAttachmentSize(48 * 1024)).toBe("48 KB");
    expect(formatAttachmentSize(2.4 * 1024 * 1024)).toBe("2.4 MB");
    expect(formatAttachmentSize(12 * 1024 * 1024)).toBe("12 MB");
    expect(formatAttachmentSize(undefined)).toBeNull();
  });
});
