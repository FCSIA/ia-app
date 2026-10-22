import { giphyGifId } from "../../../shared/chat/gifs";
import { GifDownloadError } from "./gifDownload";

/** Bump when stored media must be checked again under a newer policy. */
export const GIF_SAFETY_VERSION = 1;
const MAX_METADATA_BYTES = 256 * 1024;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

async function metadata(url: URL): Promise<Record<string, unknown>> {
  try {
    // Never forward the API key through a redirect or put provider responses in logs.
    const response = await fetch(url.toString(), {
      redirect: "error", signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" },
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
      await response.body?.cancel();
      throw new GifDownloadError("unverified");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new GifDownloadError("unverified");
    const decoder = new TextDecoder();
    let text = "";
    let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_METADATA_BYTES) throw new GifDownloadError("unverified");
        text += decoder.decode(chunk.value, { stream: true });
      }
      const data = record(JSON.parse(text + decoder.decode()));
      if (!data) throw new GifDownloadError("unverified");
      return data;
    } finally {
      await reader.cancel();
    }
  } catch {
    throw new GifDownloadError("unverified");
  }
}

/** Only download the rendition returned for the exact, positively G-rated item. */
export async function verifyGifForStorage(source: string): Promise<string> {
  const id = giphyGifId(source);
  const key = process.env.GIPHY_API_KEY?.trim();
  // Tenor has no documented rating filter on ID lookup and no new API clients.
  // Direct media and share pages cannot prove a rating. Never fall back to them.
  if (!id || !key) throw new GifDownloadError("unverified");
  const url = new URL(`https://api.giphy.com/v1/gifs/${id}`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("rating", "g");
  const body = await metadata(url);
  const item = record(body.data);
  if (record(body.meta)?.status !== 200 || item?.id !== id) throw new GifDownloadError("unverified");
  if (item.rating !== "g") throw new GifDownloadError(typeof item.rating === "string" ? "blocked" : "unverified");
  const media = record(record(item.images)?.original)?.url;
  if (typeof media !== "string" || giphyGifId(media) !== id) throw new GifDownloadError("unverified");
  return media;
}
