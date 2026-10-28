import { describe, expect, it } from "vitest";
import { extractVisionScheduleLines } from "./vision-ocr";
import { parseInfiniteCampusSchedule } from "../../web/src/lib/schedule-ocr";

function word(text: string, left: number, top: number, lineEnd = false) {
  return {
    symbols: [...text].map((text, index) => ({
      text,
      ...(lineEnd && index === text.length - 1
        ? { property: { detectedBreak: { type: "EOL_SURE_SPACE" } } }
        : {}),
    })),
    confidence: 0.97,
    boundingBox: {
      vertices: [
        { x: left, y: top },
        { x: left + text.length * 8, y: top },
        { x: left + text.length * 8, y: top + 16 },
        { x: left, y: top + 16 },
      ],
    },
  };
}
function annotation(words: unknown[]) {
  return { pages: [{ blocks: [{ paragraphs: [{ words }] }] }] };
}

describe("Google Vision schedule geometry", () => {
  it("splits one paragraph into positioned rows and separate table columns", () => {
    const result = extractVisionScheduleLines(
      annotation([
        word("1", 20, 10),
        word("World", 100, 0),
        word("History", 150, 0),
        word("Teacher:", 500, 0),
        word("Example", 570, 0, true),
        word("2", 20, 100),
        word("Chemistry", 100, 90, true),
      ]),
    );
    expect(result.map((line) => line.text)).toEqual([
      "World History",
      "Teacher: Example",
      "1",
      "Chemistry",
      "2",
    ]);
    expect(
      parseInfiniteCampusSchedule("", [], result).map((row) => [
        row.periodNumber,
        row.className,
      ]),
    ).toEqual([
      [1, "World History"],
      [2, "Chemistry"],
    ]);
  });

  it.each([4, 5])(
    "maps all class periods with lunch %s when Vision groups entire columns into paragraphs",
    (lunch) => {
      const labels = [],
        courses = [],
        teachers = [];
      for (let period = 1; period <= 8; period += 1) {
        const top = (period - 1 + (period > 4 ? 1 : 0)) * 90;
        labels.push(word(String(period), 20, top + 15, true));
        courses.push(
          word(period === lunch ? "Lunch" : `Course ${period}`, 100, top, true),
        );
        teachers.push(
          word("Teacher:", 500, top),
          word("Example", 570, top, true),
        );
        if (period === 4) {
          labels.push(word("SSS/Flex", 20, top + 105, true));
          courses.push(word("Student Success Skills", 100, top + 90, true));
        }
      }
      const source = {
        pages: [
          {
            blocks: [
              {
                paragraphs: [labels, courses, teachers].map((words) => ({
                  words,
                })),
              },
            ],
          },
        ],
      };
      expect(
        parseInfiniteCampusSchedule(
          "",
          [],
          extractVisionScheduleLines(source),
        ).map((row) => [row.periodNumber, row.className]),
      ).toEqual(
        Array.from({ length: 8 }, (_, index) => index + 1)
          .filter((period) => period !== lunch)
          .map((period) => [period, `Course ${period}`]),
      );
    },
  );

  it("does not fabricate zero-size boxes from malformed OCR data", () => {
    expect(
      extractVisionScheduleLines(
        annotation([{ symbols: [{ text: "Unknown" }] }]),
      ),
    ).toEqual([]);
    expect(
      extractVisionScheduleLines({ pages: [null, { blocks: [{}] }] }),
    ).toEqual([]);
  });

  it("accepts omitted zero coordinates and honors prefix line breaks", () => {
    const first = word("Digital", 0, 0);
    first.boundingBox.vertices = first.boundingBox.vertices.map(({ x, y }) => ({
      ...(x ? { x } : {}),
      ...(y ? { y } : {}),
    })) as typeof first.boundingBox.vertices;
    const second = word("Art", 70, 0);
    Object.assign(second.symbols[0], {
      property: { detectedBreak: { type: "LINE_BREAK", isPrefix: true } },
    });
    expect(
      extractVisionScheduleLines(annotation([first, second])).map(
        (line) => line.text,
      ),
    ).toEqual(["Digital", "Art"]);
  });
});
