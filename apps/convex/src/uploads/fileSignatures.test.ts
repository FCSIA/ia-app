import { describe, expect, test } from "vitest";
import { assertSafeStoredFile, detectRasterMime } from "./fileSignatures";

describe("stored file signatures", () => {
  test("recognizes supported raster signatures", () => {
    expect(detectRasterMime(new Uint8Array([137,80,78,71,13,10,26,10]))).toBe("image/png");
    expect(detectRasterMime(new Uint8Array([255,216,255,1]))).toBe("image/jpeg");
    expect(detectRasterMime(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
    expect(detectRasterMime(new TextEncoder().encode("RIFFxxxxWEBP"))).toBe("image/webp");
  });

  test("rejects disguised HTML, SVG, and mismatched image declarations", async () => {
    await expect(assertSafeStoredFile(new Blob(["<svg><script/></svg>"]), "image/png")).rejects.toThrow("not allowed");
    await expect(assertSafeStoredFile(new Blob(["<!doctype html><title>x</title>"]), "application/octet-stream")).rejects.toThrow("not allowed");
    await expect(assertSafeStoredFile(new Blob([new Uint8Array([255,216,255,1])]), "image/png")).rejects.toThrow("does not match");
  });
});
