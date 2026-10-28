export type VisionOcrLine = {
  text: string;
  confidence: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function bounds(value: unknown) {
  const vertices = record(value)?.vertices;
  if (!Array.isArray(vertices)) return null;
  const points = vertices
    .map(record)
    .filter((point) => point !== null)
    .map((point) => ({
      x: point.x ?? 0,
      y: point.y ?? 0,
    }))
    .filter(
      (point): point is { x: number; y: number } =>
        typeof point.x === "number" &&
        Number.isFinite(point.x) &&
        typeof point.y === "number" &&
        Number.isFinite(point.y),
    );
  if (!points.length) return null;
  const box = {
    left: Math.min(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    right: Math.max(...points.map((point) => point.x)),
    bottom: Math.max(...points.map((point) => point.y)),
  };
  return box.right > box.left && box.bottom > box.top ? box : null;
}

// Vision paragraphs may contain several rows or columns. The word boxes and
// detected breaks, not the paragraph box, own schedule line geometry.
// https://docs.cloud.google.com/vision/docs/reference/rest/v1/AnnotateImageResponse#Word
export function extractVisionScheduleLines(
  annotation: unknown,
): VisionOcrLine[] {
  const pages = record(annotation)?.pages;
  if (!Array.isArray(pages)) return [];
  const result: VisionOcrLine[] = [];
  for (const page of pages) {
    const blocks = record(page)?.blocks;
    if (!Array.isArray(blocks)) continue;
    for (const block of blocks) {
      const paragraphs = record(block)?.paragraphs;
      if (!Array.isArray(paragraphs)) continue;
      for (const paragraph of paragraphs) {
        const words = record(paragraph)?.words;
        if (!Array.isArray(words)) continue;
        let line: VisionOcrLine | null = null;
        const flush = () => {
          if (line) result.push(line);
          line = null;
        };
        for (const rawWord of words) {
          const word = record(rawWord);
          const symbols = word?.symbols;
          const box = bounds(word?.boundingBox);
          if (!Array.isArray(symbols) || !box) {
            flush();
            continue;
          }
          const entries = symbols
            .map(record)
            .filter((symbol) => symbol !== null);
          const text = entries
            .map((symbol) =>
              typeof symbol.text === "string" ? symbol.text : "",
            )
            .join("")
            .trim();
          if (!text) continue;
          const breaks = entries.map((symbol) =>
            record(record(symbol.property)?.detectedBreak),
          );
          const isLineBreak = (type: unknown) =>
            ["LINE_BREAK", "EOL_SURE_SPACE", "HYPHEN"].includes(String(type));
          if (
            breaks.some((br) => br?.isPrefix === true && isLineBreak(br.type))
          )
            flush();
          const height = box.bottom - box.top;
          if (line) {
            const overlap =
              Math.min(line.bottom, box.bottom) - Math.max(line.top, box.top);
            const sameBaseline =
              overlap >= Math.min(line.bottom - line.top, height) * 0.4;
            if (
              !sameBaseline ||
              box.left < line.left ||
              box.left - line.right > height * 2
            )
              flush();
          }
          const confidence =
            typeof word?.confidence === "number" &&
            Number.isFinite(word.confidence)
              ? word.confidence
              : 0;
          if (line) {
            line.text += ` ${text}`;
            line.left = Math.min(line.left, box.left);
            line.top = Math.min(line.top, box.top);
            line.right = Math.max(line.right, box.right);
            line.bottom = Math.max(line.bottom, box.bottom);
            line.confidence = Math.min(line.confidence, confidence);
          } else line = { text, confidence, ...box };
          if (
            breaks.some((br) => br?.isPrefix !== true && isLineBreak(br?.type))
          )
            flush();
        }
        flush();
      }
    }
  }
  return result.sort(
    (left, right) => left.top - right.top || left.left - right.left,
  );
}
