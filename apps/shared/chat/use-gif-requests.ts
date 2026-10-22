import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StoredGif } from "./stored-gifs";

type RequestGif = (args: { url: string; poster?: boolean; retry?: boolean }) => Promise<null>;

/** Reactive cache state owns completion; the editor never polls or downloads provider media. */
export function useGifRequests(
  urls: string[],
  assets: StoredGif[] | undefined,
  request: RequestGif,
  enabled: boolean,
  poster = false,
) {
  const pending = useRef(new Map<string, Promise<null>>());
  const [failures, setFailures] = useState<Record<string, boolean>>({});
  const start = useCallback((url: string, retry = false) => {
    if (pending.current.has(url)) return;
    setFailures((current) => {
      const next = { ...current };
      delete next[url];
      return next;
    });
    const task = request({ url, poster, retry });
    pending.current.set(url, task);
    void task.catch(() => {
      setFailures((current) => ({ ...current, [url]: true }));
    }).finally(() => {
      if (pending.current.get(url) === task) pending.current.delete(url);
    });
  }, [poster, request]);
  useEffect(() => {
    if (!enabled || !assets) return;
    for (const asset of assets) {
      if (asset.status === "missing" && !failures[asset.sourceUrl]) start(asset.sourceUrl);
    }
  }, [assets, enabled, failures, start]);
  // Bound failures to the current draft/page, including drafts edited for a long time.
  const signature = urls.join("\n");
  useEffect(() => {
    const active = new Set(signature.split("\n"));
    setFailures((current) => {
      if (Object.keys(current).every((url) => active.has(url))) return current;
      return Object.fromEntries(Object.entries(current).filter(([url]) => active.has(url)));
    });
  }, [signature]);
  const states = useMemo(() => urls.map((sourceUrl): StoredGif => {
    const asset = assets?.find((item) => item.sourceUrl === sourceUrl);
    return failures[sourceUrl] && asset?.status !== "ready"
      ? { sourceUrl, status: "error", url: null, error: "network" }
      : asset ?? { sourceUrl, status: "loading", url: null, error: null };
  }), [urls, assets, failures]);
  return { states, retry: (url: string) => start(url, true), blocked: states.some((item) => item.status !== "ready") };
}
