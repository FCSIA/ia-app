import type { ScheduleOcrLine } from "./schedule-ocr";
import type { ImageLike, PSM, Worker } from "tesseract.js";

export function scheduleLinesFromTsv(tsv: string): ScheduleOcrLine[] {
  const lines = new Map<string, ScheduleOcrLine>();
  const segmentNumbers = new Map<string, number>();
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
    )
      continue;

    // Tesseract often puts the period, course, and teacher in one TSV line.
    // Preserve its large column gaps instead of flattening the whole row.
    const lineKey = fields.slice(1, 5).join(":");
    let segment = segmentNumbers.get(lineKey) ?? 0;
    const previous = lines.get(`${lineKey}:${segment}`);
    if (
      previous &&
      left - previous.right >
        Math.max(height, previous.bottom - previous.top) * 2
    )
      segment += 1;
    segmentNumbers.set(lineKey, segment);
    const key = `${lineKey}:${segment}`;
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

export async function recognizeScheduleImage(
  worker: Pick<Worker, "recognize" | "setParameters">,
  image: ImageLike,
  height: number,
): Promise<{ fullText: string; lines: ScheduleOcrLine[] }> {
  const output = { text: true, tsv: true };
  // Workers may be reused for several images; the preceding digit/sparse pass
  // must not change the next image's initial recognition mode.
  await worker.setParameters({
    tessedit_pageseg_mode: "3" as PSM,
    tessedit_char_whitelist: "",
  });
  let initial = await worker.recognize(image, {}, output);
  let initialLines = scheduleLinesFromTsv(initial.data.tsv ?? "");
  const findColumn = (lines: ScheduleOcrLine[]) => {
    const digits = lines.filter((line) => /^[1-9]$/.test(line.text));
    const column = digits
      .map((anchor) =>
        digits.filter(
          (line) =>
            Math.abs(line.left - anchor.left) <=
            Math.max(1, anchor.bottom - anchor.top),
        ),
      )
      .sort(
        (left, right) =>
          right.length - left.length || left[0].left - right[0].left,
      )[0];
    if (!column) return null;
    if (new Set(column.map((line) => line.text)).size >= 2) return column;
    // A single-row crop still has explicit evidence: its label is to the
    // left of the content. The independent digit pass must agree below.
    return digits.length === 1 &&
      lines.some(
        (line) =>
          line.left > column[0].right + (column[0].bottom - column[0].top),
      )
      ? column
      : null;
  };
  let column = findColumn(initialLines);
  if (!column) {
    // Automatic page segmentation can discard every isolated digit. A full
    // block pass reads row-aligned labels without assuming their positions.
    await worker.setParameters({ tessedit_pageseg_mode: "6" as PSM });
    const block = await worker.recognize(image, {}, output);
    const blockLines = scheduleLinesFromTsv(block.data.tsv ?? "");
    column = findColumn(blockLines);
    if (column) {
      initial = block;
      initialLines = blockLines;
    }
  }
  if (!column) {
    // SSS/Flex is another explicit label in the period column. It can locate
    // the crop, but never supplies or implies a numerical period assignment.
    const flex = initialLines.find((line) =>
      /^sss\s*\/?\s*flex\b/i.test(line.text),
    );
    if (!flex)
      return { fullText: initial.data.text ?? "", lines: initialLines };
    column = [
      { ...flex, right: flex.left + (flex.bottom - flex.top), text: "" },
    ];
  }
  const margin = Math.max(...column.map((line) => line.bottom - line.top)) / 5;
  const left = Math.max(
    0,
    Math.floor(Math.min(...column.map((line) => line.left)) - margin),
  );
  const right = Math.ceil(
    Math.max(...column.map((line) => line.right)) + margin,
  );
  await worker.setParameters({
    tessedit_pageseg_mode: "6" as PSM, // Single block: the narrow period column.
    tessedit_char_whitelist: "123456789",
  });
  const labels = await worker.recognize(
    image,
    {
      rectangle: { left, top: 0, width: right - left, height },
    },
    output,
  );
  // Sparse text keeps course names separate from the teacher/room columns.
  await worker.setParameters({
    tessedit_pageseg_mode: "11" as PSM, // Sparse text: independent course/metadata cells.
    tessedit_char_whitelist: "",
  });
  const text = await worker.recognize(image, {}, output);
  const sparseLines = scheduleLinesFromTsv(text.data.tsv ?? "");
  const flexLines = sparseLines.filter((line) =>
    /^(?:sss\b|flex\b|student success skills\b)/i.test(line.text),
  );
  const labelLines = scheduleLinesFromTsv(labels.data.tsv ?? "")
    .filter((line) => /^[1-9]$/.test(line.text))
    .filter(
      (line) =>
        !flexLines.some((flex) => {
          const center = (line.top + line.bottom) / 2;
          const padding = (flex.bottom - flex.top) / 2;
          return (
            center >= flex.top - padding && center <= flex.bottom + padding
          );
        }),
    )
    .sort((left, right) => left.top - right.top);
  const labelsAreUnique =
    new Set(labelLines.map((line) => line.text)).size === labelLines.length;
  const textLines = sparseLines.filter(
    (line) =>
      !(line.left >= left && line.right <= right && /^[1-9]$/.test(line.text)),
  );
  return {
    fullText: text.data.text ?? "",
    lines:
      labelsAreUnique &&
      labelLines.length >=
        Math.max(
          column[0].text ? 1 : 2,
          new Set(column.map((line) => line.text)).size,
        ) &&
      (column.length !== 1 ||
        !column[0].text ||
        labelLines.some((line) => line.text === column[0].text))
        ? [...textLines, ...labelLines]
        : initialLines,
  };
}

export function scheduleOcrImageDimensions(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("This picture has invalid dimensions.");
  }
  // Zoom is independent of screenshot contents or which student supplied it.
  // A pixel budget also bounds panoramas, tall phone captures, and camera photos.
  const scale = Math.min(4, Math.sqrt(16_000_000 / (width * height)));
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}

async function prepareScheduleImage(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    // Small portal screenshots have ~10px text. Enlarge before recognition,
    // while bounding memory for camera photos and very large images.
    const dimensions = scheduleOcrImageDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Could not prepare this picture for reading.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    bitmap.close();
  }
}

export async function readScheduleImageLocally(
  file: File,
  onProgress: (value: number) => void,
): Promise<{ fullText: string; lines: ScheduleOcrLine[] }> {
  const { createWorker } = await import("tesseract.js");
  const image = await prepareScheduleImage(file);
  let progress = 10;
  const worker = await createWorker("eng", 1, {
    workerPath: "/schedule-ocr-assets/worker.min.js",
    corePath: "/schedule-ocr-assets",
    workerBlobURL: false,
    logger: (message) => {
      if (message.status === "recognizing text") {
        progress = Math.max(progress, 20 + Math.round(message.progress * 70));
        onProgress(progress);
      }
    },
  });
  try {
    return await recognizeScheduleImage(worker, image, image.height);
  } finally {
    await worker.terminate();
  }
}
