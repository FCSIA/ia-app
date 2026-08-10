import { describe, expect, test } from "vitest";
import { assertSafeStoredFile, detectRasterMime } from "./fileSignatures";

function contents(parts: BlobPart[]) {
  return new Blob(parts).arrayBuffer();
}

describe("stored file signatures", () => {
  test("recognizes supported raster signatures", () => {
    expect(detectRasterMime(new Uint8Array([137,80,78,71,13,10,26,10]))).toBe("image/png");
    expect(detectRasterMime(new Uint8Array([255,216,255,1]))).toBe("image/jpeg");
    expect(detectRasterMime(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
    expect(detectRasterMime(new TextEncoder().encode("RIFFxxxxWEBP"))).toBe("image/webp");
  });

  test("rejects disguised HTML, SVG, and mismatched image declarations", async () => {
    const svg = await contents(["<svg><script/></svg>"]);
    const html = await contents(["<!--safe--><html><title>x</title>"]);
    const xml = await contents(["<?xml version='1.0'?><svg></svg>"]);
    const jpeg = await contents([new Uint8Array([255, 216, 255, 1])]);

    expect(() => assertSafeStoredFile(svg, "image/png")).toThrow(
      "not allowed",
    );
    expect(() => assertSafeStoredFile(html, "application/pdf")).toThrow(
      "not allowed",
    );
    expect(() => assertSafeStoredFile(xml, "application/pdf")).toThrow(
      "not allowed",
    );
    expect(() => assertSafeStoredFile(jpeg, "image/png")).toThrow(
      "does not match",
    );
  });

  test("validates supported non-image signatures and rejects unknown types", async () => {
    const pdf = await contents(["%PDF-1.7\ncontent"]);
    const invalidPdf = await contents(["not a pdf"]);
    const zip = await contents([new Uint8Array([0x50, 0x4b, 0x03, 0x04])]);
    const opaque = await contents(["opaque"]);

    expect(() => assertSafeStoredFile(pdf, "application/pdf")).not.toThrow();
    expect(() => assertSafeStoredFile(invalidPdf, "application/pdf")).toThrow(
      "does not match",
    );
    expect(() => assertSafeStoredFile(zip, "application/zip")).not.toThrow();
    expect(() =>
      assertSafeStoredFile(opaque, "application/octet-stream"),
    ).toThrow("not supported");
  });

  test("only inspects the first signature window", async () => {
    const file = new Uint8Array(8192);
    file.set([137, 80, 78, 71, 13, 10, 26, 10]);

    expect(() => assertSafeStoredFile(file.buffer, "image/png")).not.toThrow();
  });
});
