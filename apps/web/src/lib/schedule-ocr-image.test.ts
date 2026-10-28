import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import {
  recognizeScheduleImage,
  scheduleOcrImageDimensions,
} from "./schedule-ocr-local";
import { parseInfiniteCampusSchedule } from "./schedule-ocr";

// Opt in with the owner's local image; do not commit a student screenshot.
const screenshot = process.env.SCHEDULE_OCR_IMAGE;
describe.skipIf(!screenshot)("real Campus screenshot OCR", () => {
  it("recognizes seven classes, reserves period 5 for lunch, and excludes SSS", async () => {
    const original = sharp(screenshot);
    const size = await original.metadata();
    const image = await original
      .resize(scheduleOcrImageDimensions(size.width!, size.height!))
      .flatten({ background: "white" })
      .png()
      .toBuffer();
    const { height } = await sharp(image).metadata();
    const worker = await createWorker("eng", 1, { cachePath: tmpdir() });
    try {
      const result = await recognizeScheduleImage(worker, image, height!);
      const rows = parseInfiniteCampusSchedule(
        result.fullText,
        [],
        result.lines,
      );
      expect(rows.map((row) => [row.periodNumber, row.className])).toEqual([
        [1, "Gifted Internship I"],
        [2, "WBL-IT"],
        [3, "College Appl Cmbntrcs"],
        [4, "AP Physics C Mech"],
        [6, "AP Psychology"],
        [7, "AP Cybersecurity"],
        [8, "College Prin of Acct I"],
      ]);
    } finally {
      await worker.terminate();
    }
  }, 60_000);
});

// Synthetic fixtures vary student schedules, layout, font size, lunch, and file
// encoding. They do not use or distribute real student images.
const integration =
  process.env.SCHEDULE_OCR_INTEGRATION === "1" || Boolean(screenshot);
const courseNames = [
  "Chemistry",
  "World History",
  "Digital Art",
  "Algebra",
  "Spanish",
  "Engineering",
  "Literature",
  "Music Technology",
];
const imageCases = [
  {
    name: "single-row period 6 crop",
    width: 960,
    lunch: 5,
    format: "png",
    mobile: false,
    first: 6,
    last: 6,
  },
  {
    name: "dark desktop / lunch 5",
    width: 960,
    lunch: 5,
    format: "png",
    mobile: false,
    first: 1,
    dark: true,
  },
  {
    name: "desktop PNG / lunch 4",
    width: 960,
    lunch: 4,
    format: "png",
    mobile: false,
    first: 1,
  },
  {
    name: "compact JPEG / lunch 5",
    width: 640,
    lunch: 5,
    format: "jpeg",
    mobile: false,
    first: 1,
  },
  {
    name: "large WebP / lunch 4",
    width: 1440,
    lunch: 4,
    format: "webp",
    mobile: false,
    first: 1,
  },
  {
    name: "cropped periods 3-8 / lunch 5",
    width: 960,
    lunch: 5,
    format: "png",
    mobile: false,
    first: 3,
  },
  {
    name: "phone cards / lunch 5",
    width: 480,
    lunch: 5,
    format: "png",
    mobile: true,
    first: 1,
  },
] as const;

function scheduleSvg(
  lunch: number,
  mobile: boolean,
  first: number,
  last = 8,
  dark = false,
) {
  const width = mobile ? 480 : 960;
  const rowHeight = mobile ? 120 : 72;
  const height =
    60 + (last - first + 1 + (first <= 4 && last >= 4 ? 1 : 0)) * rowHeight;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${dark ? "#171717" : "white"}"/><g font-family="Arial" font-size="20" fill="${dark ? "#eee" : "#111"}">`;
  let row = 0;
  for (let period = first; period <= last; period += 1) {
    const draw = (label: string, title: string) => {
      const y = 60 + row * rowHeight;
      svg += `<path d="M5 ${y - 20}H${width - 5}" stroke="#ddd"/>`;
      svg += `<text x="20" y="${y + 8}">${label}</text>`;
      svg += `<text x="${mobile ? 40 : 120}" y="${y + (mobile ? 40 : 0)}" fill="${dark ? "#70b8ff" : "#064a9b"}">${title}</text>`;
      svg += `<text x="${mobile ? 40 : 560}" y="${y + (mobile ? 75 : 0)}" font-size="15">Teacher: Test Teacher</text>`;
      if (!mobile)
        svg += `<text x="120" y="${y + 27}" font-size="14">8:10 AM - 8:55 AM</text>`;
      row += 1;
    };
    draw(
      mobile ? `Period ${period}` : String(period),
      period === lunch ? "Lunch" : courseNames[period - 1],
    );
    if (period === 4) draw("SSS/Flex", "Student Success Skills");
  }
  return Buffer.from(`${svg}</g></svg>`);
}

describe.skipIf(!integration)(
  "generated Campus schedule image variations",
  () => {
    let worker: Awaited<ReturnType<typeof createWorker>>;
    beforeAll(async () => {
      worker = await createWorker("eng", 1, { cachePath: tmpdir() });
    }, 60_000);
    afterAll(async () => {
      await worker?.terminate();
    });
    it.each(imageCases)(
      "recognizes $name",
      async (fixture) => {
        const original = await sharp(
          scheduleSvg(
            fixture.lunch,
            fixture.mobile,
            fixture.first,
            "last" in fixture ? fixture.last : 8,
            "dark" in fixture && fixture.dark,
          ),
        )
          .resize({ width: fixture.width })
          .toFormat(fixture.format)
          .toBuffer();
        const size = await sharp(original).metadata();
        const image = await sharp(original)
          .resize(scheduleOcrImageDimensions(size.width!, size.height!))
          .png()
          .toBuffer();
        const { height } = await sharp(image).metadata();
        const result = await recognizeScheduleImage(worker, image, height!);
        const rows = parseInfiniteCampusSchedule(
          result.fullText,
          [],
          result.lines,
        );
        expect(rows.map((row) => [row.periodNumber, row.className])).toEqual(
          courseNames.flatMap((title, index) =>
            index + 1 < fixture.first ||
            index + 1 > ("last" in fixture ? fixture.last : 8) ||
            index + 1 === fixture.lunch
              ? []
              : [[index + 1, title]],
          ),
        );
      },
      60_000,
    );
  },
);
