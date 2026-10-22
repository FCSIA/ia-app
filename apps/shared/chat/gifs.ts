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

/**
 * GIF media CDNs the backend may download into object storage. Keep this list
 * closed so pasted links cannot turn the downloader into an arbitrary proxy.
 */
const GIF_MEDIA_HOST = /^(?:(?:media\d*|i)\.giphy\.com|(?:media\d*|c)\.tenor\.com)$/;

/** URLs a message's "Copy GIF URL" action offers: previewed links, then uploads. */
export function messageGifUrls(message: {
  body: string;
  bodyMarkdown?: string | null;
  attachments?: ReadonlyArray<{
    fileName: string;
    fileUrl: string;
    mimeType?: string | null;
  }> | null;
}) {
  return [
    ...extractChatGifLinks(message.bodyMarkdown || message.body).map(
      (link) => link.url,
    ),
    ...(message.attachments ?? [])
      .filter(isGifAttachment)
      .map((attachment) => attachment.fileUrl),
  ];
}

export function chatGifLink(value: string): ChatGifLink | null {
  if (value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
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
    if (!GIF_MEDIA_HOST.test(url.hostname) || !/\.gif$/i.test(url.pathname))
      return null;
    // Tenor's /m/ endpoint serves an HTML viewer to browser requests.
    const viewerId = /^(?:media\d*|c)\.tenor\.com$/.test(url.hostname)
      ? url.pathname.match(/^\/m\/([a-zA-Z0-9_-]+)\//)?.[1]
      : null;
    return {
      url: url.toString(),
      mediaUrl: viewerId
        ? `https://c.tenor.com/${viewerId}/tenor.gif`
        : url.toString(),
    };
  } catch {
    return null;
  }
}

/** Bounded previews of pasted URLs and Markdown links, excluding code examples. */
export function extractChatGifLinks(text: string): ChatGifLink[] {
  const links = new Map<string, ChatGifLink>();
  const prose = text
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, "")
    // Older rich-text messages escaped Markdown punctuation inside bare URLs.
    .replace(/\\([_*~])/g, "$1");
  for (const match of prose.matchAll(/https:\/\/[^\s<>"\[\]\\]+/gi)) {
    const link = chatGifLink(match[0].replace(/[),.!?;:]+$/, ""));
    if (link) links.set(link.mediaUrl ?? link.url, link);
    if (links.size === 5) break;
  }
  return [...links.values()];
}

/** Editable ranges let removal preserve surrounding prose, mentions and formatting. */
export function chatGifLinkRanges(text: string, target: string) {
  const expected = chatGifLink(target);
  if (!expected) return [];
  const key = expected.mediaUrl ?? expected.url;
  const ranges: Array<{ start: number; end: number }> = [];
  let offset = 0;
  const parts = text.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g);
  parts.forEach((part, index) => {
    if (index % 2 === 0) {
      for (const match of part.matchAll(/\[[^\]\n]*\]\((https:\/\/[^\s]+)\)|<(https:\/\/[^\s<>]+)>|https:\/\/[^\s<>"\[\]]+/gi)) {
        const wrapped = match[1] ?? match[2];
        const raw = wrapped ?? match[0].replace(/[),.!?;:]+$/, "");
        const link = chatGifLink(raw.replace(/\\([_*~])/g, "$1"));
        if (link && (link.mediaUrl ?? link.url) === key) {
          ranges.push({ start: offset + match.index!, end: offset + match.index! + (wrapped ? match[0].length : raw.length) });
        }
      }
    }
    offset += part.length;
  });
  return ranges;
}

export function removeChatGifLink(text: string, url: string) {
  for (const range of chatGifLinkRanges(text, url).reverse()) {
    text = text.slice(0, range.start) + text.slice(range.end);
  }
  return text;
}

/** Hide only URLs represented by bounded previews; keep prose and code intact. */
export function hideChatGifLinks(text: string, source = text): string {
  const previews = extractChatGifLinks(source);
  const hidden = (value: string) => {
    const link = chatGifLink(value.replace(/\\([_*~])/g, "$1"));
    return link && previews.some((preview) =>
      (preview.mediaUrl ?? preview.url) === (link.mediaUrl ?? link.url));
  };
  return text.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g)
    .map((part, index) => index % 2 ? part : part
      .replace(/\[([^\]\n]*)\]\((https:\/\/[^\s]+)\)/gi,
        (match, _label: string, url: string) => hidden(url) ? "" : match)
      .replace(/<(https:\/\/[^\s<>]+)>/gi,
        (match, url: string) => hidden(url) ? "" : match)
      .replace(/https:\/\/[^\s<>"\[\]]+/gi, (match) => {
        const url = match.replace(/[),.!?;:]+$/, "");
        return hidden(url) ? match.slice(url.length) : match;
      }))
    .join("").trim();
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
