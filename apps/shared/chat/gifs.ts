export type ChatGifLink = { url: string; mediaUrl: string | null };

export function isGifAttachment(file: {
  mimeType?: string | null;
  fileName: string;
}) {
  const mime = file.mimeType?.split(";", 1)[0].trim().toLowerCase();
  return (
    mime === "image/gif" ||
    ((!mime || mime === "application/octet-stream") &&
      /\.gif$/i.test(file.fileName))
  );
}

export function chatGifLink(value: string): ChatGifLink | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return null;
    // Do not automatically contact local network addresses through message previews.
    if (
      !url.hostname.includes(".") ||
      url.hostname.startsWith("[") ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname) ||
      url.hostname.endsWith(".local")
    )
      return null;
    if (url.hostname === "tenor.com" || url.hostname === "www.tenor.com") {
      if (
        /^\/(?:[a-z]{2}\/)?view\/[a-zA-Z0-9-]+-\d+$/.test(url.pathname) ||
        /^\/[a-zA-Z0-9]+\.gif$/.test(url.pathname)
      ) {
        url.search = "";
        url.hash = "";
        return { url: url.toString(), mediaUrl: null };
      }
      return null;
    }
    if (url.hostname === "giphy.com" || url.hostname === "www.giphy.com") {
      const id =
        url.pathname.match(
          /^\/(?:gifs|stickers)\/(?:[a-zA-Z0-9-]+-)?([a-zA-Z0-9]+)\/?$/,
        )?.[1] ?? url.pathname.match(/^\/embed\/([a-zA-Z0-9]+)\/?$/)?.[1];
      if (!id) return null;
      return {
        url: url.toString(),
        mediaUrl: `https://media.giphy.com/media/${id}/giphy.gif`,
      };
    }
    return /\.gif$/i.test(url.pathname)
      ? { url: url.toString(), mediaUrl: url.toString() }
      : null;
  } catch {
    return null;
  }
}

/** Bounded previews of pasted URLs and Markdown links, excluding code examples. */
export function extractChatGifLinks(text: string): ChatGifLink[] {
  const links = new Map<string, ChatGifLink>();
  const prose = text.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, "");
  for (const match of prose.matchAll(/https:\/\/[^\s<>"\[\]\\]+/gi)) {
    const link = chatGifLink(match[0].replace(/[),.!?;:]+$/, ""));
    if (link) links.set(link.mediaUrl ?? link.url, link);
    if (links.size === 5) break;
  }
  return [...links.values()];
}

/** Only accept GIF media from Tenor's exact CDN hosts, never provider HTML. */
export function tenorGifFromHtml(html: string): string | null {
  for (const match of html.matchAll(
    /https:\/\/(?:media\d*|c)\.tenor\.com\/[^\s"'<>\\]+\.gif(?:\?[^\s"'<>\\]*)?/gi,
  )) {
    const link = chatGifLink(match[0].replace(/&amp;/g, "&"));
    if (link?.mediaUrl) return link.mediaUrl;
  }
  return null;
}
