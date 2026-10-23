import type { ScheduleOcrLine } from "./schedule-ocr";

export function scheduleLinesFromTsv(tsv: string): ScheduleOcrLine[] {
  const lines = new Map<string, ScheduleOcrLine>();
  for (const row of tsv.split(/\r?\n/).slice(1)) {
    const fields = row.split("\t");
    if (fields[0] !== "5") continue;
    const word = fields.slice(11).join("\t").trim();
    const left = Number(fields[6]);
    const top = Number(fields[7]);
    const width = Number(fields[8]);
    const height = Number(fields[9]);
    if (
      !word ||
      !Number.isFinite(left) ||
      !Number.isFinite(top) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) continue;

    const key = fields.slice(1, 5).join(":");
    const existing = lines.get(key);
    if (existing) {
      existing.text += ` ${word}`;
      existing.left = Math.min(existing.left, left);
      existing.top = Math.min(existing.top, top);
      existing.right = Math.max(existing.right, left + width);
      existing.bottom = Math.max(existing.bottom, top + height);
    } else {
      lines.set(key, {
        text: word,
        left,
        top,
        right: left + width,
        bottom: top + height,
      });
    }
  }
  return [...lines.values()];
}

export async function readScheduleImageLocally(
  file: File,
  onProgress: (value: number) => void,
): Promise<{ fullText: string; lines: ScheduleOcrLine[] }> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    workerPath: "/schedule-ocr-assets/worker.min.js",
    corePath: "/schedule-ocr-assets",
    workerBlobURL: false,
    logger: (message) => {
      if (message.status === "recognizing text") {
        onProgress(20 + Math.round(message.progress * 75));
      }
    },
  });
  try {
    const result = await worker.recognize(file, {}, { text: true, tsv: true });
    return {
      fullText: result.data.text ?? "",
      lines: scheduleLinesFromTsv(result.data.tsv ?? ""),
    };
  } finally {
    await worker.terminate();
  }
}
