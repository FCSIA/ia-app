/** Cache only small resolution results, never GIF bytes or decoded frames. */
export function createGifLinkCache(limit = 200) {
  const entries = new Map<string, Promise<string | null>>();
  return (resolve: (args: { url: string }) => Promise<string | null>, url: string) => {
    let pending = entries.get(url);
    if (!pending) {
      pending = resolve({ url }).catch((error: unknown) => {
        // An evicted request must not delete a newer request for the same URL.
        if (entries.get(url) === pending) entries.delete(url);
        throw error;
      });
      entries.set(url, pending);
      if (entries.size > limit) entries.delete(entries.keys().next().value!);
    }
    return pending;
  };
}
