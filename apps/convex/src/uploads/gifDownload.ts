import { chatGifLink } from "../../../shared/chat/gifs";
import { SCHOOL_GIFS } from "../../../shared/chat/school-gifs";
import type { StoredGifError } from "../../../shared/chat/stored-gifs";
import { assertSafeStoredFile } from "./fileSignatures";

export class GifDownloadError extends Error {
  constructor(readonly code: StoredGifError) { super(code); }
}

const MAX_GIF_BYTES = 10 * 1024 * 1024;
const MAX_TTL_MS = 24 * 60 * 60 * 1000;

/** A shared cache must obey the provider's freshness and no-store directives. */
export function gifCacheTtl(headers: Headers, now = Date.now()) {
  const control = headers.get("cache-control") ?? "";
  if (/(?:^|,)\s*(?:private|no-store|no-cache)\b/i.test(control)) return 0;
  const seconds = control.match(/(?:^|,)\s*s-maxage\s*=\s*"?([0-9]+)"?/i)
    ?? control.match(/(?:^|,)\s*max-age\s*=\s*"?([0-9]+)"?/i);
  const age = Math.max(0, Number(headers.get("age")) || 0) * 1000;
  if (seconds) return Math.max(0, Math.min(MAX_TTL_MS, Number(seconds[1]) * 1000 - age));
  const expires = Date.parse(headers.get("expires") ?? "");
  return Number.isFinite(expires) ? Math.max(0, Math.min(MAX_TTL_MS, expires - now)) : MAX_TTL_MS;
}

/** No arbitrary hosts, automatic redirects, unbounded bodies, or provider HTML. */
export async function downloadGif(source: string, poster = false) {
  if (poster ? !SCHOOL_GIFS.some((gif) => gif.poster === source) : chatGifLink(source)?.mediaUrl !== source) {
    throw new GifDownloadError("unsupported");
  }
  let url = source;
  const signal = AbortSignal.timeout(8000);
  for (let redirects = 0; redirects <= 2; redirects++) {
    const response = await fetch(url, { redirect: "manual", signal });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || poster) throw new GifDownloadError("unavailable");
      const next = chatGifLink(new URL(location, url).toString());
      if (!next?.mediaUrl) throw new GifDownloadError("unsupported");
      url = next.mediaUrl;
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new GifDownloadError(response.status === 404 || response.status === 410 ? "unavailable" : "network");
    }
    const declared = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    // Tenor serves most catalog .png posters as single-frame GIFs.
    const mime = poster && declared === "image/png" ? "image/png" : "image/gif";
    const ttl = gifCacheTtl(response.headers);
    const maxBytes = poster ? 1024 * 1024 : MAX_GIF_BYTES;
    const size = Number(response.headers.get("content-length"));
    if (size > maxBytes || (declared && declared !== mime) || ttl <= 0) {
      await response.body?.cancel();
      throw new GifDownloadError(size > maxBytes ? "too-large" : "unsupported");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new GifDownloadError("unavailable");
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maxBytes) throw new GifDownloadError("too-large");
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try { assertSafeStoredFile(bytes.buffer, mime); }
    catch { throw new GifDownloadError("unsupported"); }
    return { blob: new Blob([bytes], { type: mime }), ttl };
  }
  throw new GifDownloadError("unavailable");
}
