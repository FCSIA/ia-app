/** Cache states are shared by the web/native composers and message previews. */
export type StoredGifError = "network" | "unavailable" | "too-large" | "unsupported";
export type StoredGif = {
  sourceUrl: string;
  status: "missing" | "loading" | "ready" | "error";
  url: string | null;
  error: StoredGifError | null;
};

export function gifErrorMessage(error: StoredGifError | null) {
  switch (error) {
    case "too-large": return "This GIF is larger than 10 MB. Try a smaller one.";
    case "unsupported": return "This link can't be previewed. Try another GIF.";
    case "unavailable": return "This GIF is no longer available. Try another link.";
    default: return "Couldn't load this GIF. Check your connection and retry.";
  }
}
