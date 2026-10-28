import type { CourseSummary } from "@/components/courses/types";

export type OcrScheduleRow = {
  id: string;
  periodNumber: number | null;
  sourceText: string;
  className: string;
  matchedCourse: CourseSummary | null;
  confidence: number;
};

export type ImportedScheduleRow = {
  periodNumber: number;
  course: CourseSummary | null;
  className: string;
};

export type ScheduleOcrLine = {
  text: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const MAX_CLASS_PERIOD = 8;
const NON_CLASS_ROW =
  /^(?:s[5s][5s](?:\s*\/?\s*flex)?|flex(?:\s*\/\s*student success skills)?|student success skills|lunch)\b/i;

const PERIOD_LABEL =
  /^(?:(?:period|per\.?|p)\s*#?\s*(\d{1,2})\b|#?\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s*period\b|(?=\s|[.:-](?!\d)|$)))\s*[.\-:|]?\s*/i;
type PeriodReadings = Map<number, string[][]>;

function periodLabel(text: string) {
  // Clock times and course codes are not period labels.
  if (/^\d{1,2}:\d{2}/.test(text)) return null;
  const match = text.match(PERIOD_LABEL);
  return match
    ? {
        period: Number(match[1] ?? match[2]),
        remainder: text.slice(match[0].length),
      }
    : null;
}

function addReading(
  readings: PeriodReadings,
  period: number,
  candidates: string[],
) {
  const existing = readings.get(period) ?? [];
  existing.push(candidates);
  readings.set(period, existing);
}
const IGNORED_LINE =
  /^(?:(?:schedule|calendar|term|quarter|semester|teacher|room|attendance|grades?|today|day|week|agenda)(?:\s+\d+)?|no scheduled course)$/i;
const DETAIL_LINE = /^(?:teacher|instructor|room|staff|start|end|time)(?:\s*[:;]|\s+\d+\b|$)/i;
const WEEKDAY_LINE =
  /^(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i;
const TIME_LINE =
  /^\d{1,2}:\d{2}\s*(?:am|pm)?(?:\s*[-–]\s*\d{1,2}:\d{2}\s*(?:am|pm)?)?$/i;
const TIME_PREFIX = /^\d{1,2}:\d{2}\s*(?:am|pm)?\s*[-–]/i;

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bigrams(value: string) {
  const compact = normalize(value).replace(/\s/g, "");
  const result = new Set<string>();
  for (let index = 0; index < compact.length - 1; index += 1) {
    result.add(compact.slice(index, index + 2));
  }
  return result;
}

function overlapScore(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const value of left) if (right.has(value)) overlap += 1;
  return (2 * overlap) / (left.size + right.size);
}

function courseMatchScore(candidate: string, course: CourseSummary) {
  const normalizedCandidate = normalize(candidate);
  const normalizedTitle = normalize(course.title);
  if (!normalizedCandidate || !normalizedTitle) return 0;
  if (
    course.courseNumbers.some((number) => {
      const code = normalize(number);
      return (
        code.length >= 3 && ` ${normalizedCandidate} `.includes(` ${code} `)
      );
    })
  )
    return 0.995;
  // Keep course levels distinct. A fuzzy match must not downgrade AP/Honors
  // or replace a numbered course with another course in the same family.
  const levelTokens = (value: string) =>
    new Set(
      value
        .split(" ")
        .filter((token) =>
          /^(?:ap|ib|honors?|honours?|h|[1-9]|i|ii|iii|iv)$/.test(token),
        )
        .map((token) =>
          /^(?:honors?|honours?|h)$/.test(token) ? "honors" : token,
        ),
    );
  const candidateLevels = levelTokens(normalizedCandidate);
  const titleLevels = levelTokens(normalizedTitle);
  if (
    ["ap", "ib", "honors"].some(
      (level) => candidateLevels.has(level) !== titleLevels.has(level),
    )
  )
    return 0;
  if ([...candidateLevels].some((level) => !titleLevels.has(level))) return 0;
  if (normalizedCandidate === normalizedTitle) return 1;
  if (
    normalizedTitle.startsWith(normalizedCandidate) &&
    normalizedCandidate.length >= 4
  )
    return 0.96;
  // A generic catalog title such as "Physics" must not outrank the more
  // specific prefix match "AP Physics C Mech" -> "AP Physics C Mechanics".
  if (normalizedCandidate.includes(normalizedTitle)) {
    return 0.8 + 0.19 * (normalizedTitle.length / normalizedCandidate.length);
  }
  if (
    normalizedTitle.includes(normalizedCandidate) &&
    normalizedCandidate.length >= 6
  ) {
    return 0.9;
  }

  const candidateTokens = new Set(
    normalizedCandidate.split(" ").filter((token) => token.length > 1),
  );
  const titleTokens = new Set(
    normalizedTitle.split(" ").filter((token) => token.length > 1),
  );
  const tokenScore = overlapScore(candidateTokens, titleTokens);
  const bigramScore = overlapScore(
    bigrams(normalizedCandidate),
    bigrams(normalizedTitle),
  );
  return tokenScore * 0.62 + bigramScore * 0.38;
}

function meaningfulLine(value: string) {
  const line = value
    .replace(/\s+(?:teacher|room|start)\s*[:;].*$/i, "")
    .replace(/\s+\|$/, " I")
    .replace(/\s+/g, " ")
    .trim();
  if (
    line.length < 3 ||
    IGNORED_LINE.test(line) ||
    DETAIL_LINE.test(line) ||
    WEEKDAY_LINE.test(line) ||
    TIME_LINE.test(line) ||
    TIME_PREFIX.test(line) ||
    NON_CLASS_ROW.test(line)
  ) {
    return null;
  }
  return line;
}

function rowsFromLayout(lines: ScheduleOcrLine[]) {
  const markers = lines
    .map((line) => ({
      ...line,
      label: line.text.replace(/\s+/g, " ").trim(),
      period: periodLabel(line.text.trim())?.period ?? 0,
    }))
    .filter((line) => line.period > 0 || /^sss\s*\/\s*flex\b/i.test(line.label))
    .sort((left, right) => left.top - right.top);
  if (
    markers.filter((line) => line.period >= 1 && line.period <= 8).length === 0
  )
    return null;

  // Each aligned period column is independent (e.g. two terms side by side).
  const columns: (typeof markers)[] = [];
  for (const marker of markers) {
    const column = columns.find(
      (group) =>
        Math.abs(group[0].left - marker.left) <=
        Math.max(1, marker.bottom - marker.top),
    );
    if (column) column.push(marker);
    else columns.push([marker]);
  }
  columns.sort((left, right) => left[0].left - right[0].left);
  const grouped: PeriodReadings = new Map();
  const used = new Set<ScheduleOcrLine>();
  const courseColumns: {
    left: number;
    height: number;
    top: number;
    bottom: number;
  }[] = [];
  const excludedBands: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }[] = [];
  for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
    const column = columns[columnIndex];
    const gaps = column
      .slice(1)
      .map((marker, index) => marker.top - column[index].top)
      .filter((gap) => gap > 0)
      .sort((a, b) => a - b);
    // Cap row bands at the typical spacing, so a missing label cannot merge
    // its class into the preceding class. This is relative to the OCR geometry.
    const pitch = gaps[Math.floor((gaps.length - 1) / 2)];
    const nextColumn = columns[columnIndex + 1]?.[0].left ?? Infinity;
    for (let index = 0; index < column.length; index += 1) {
      const marker = column[index];
      const period = marker.period;
      const height = marker.bottom - marker.top;
      const radius = (pitch ?? height * 6) / 2;
      const previous = column[index - 1];
      const next = column[index + 1];
      const top = Math.max(
        marker.top - radius,
        previous ? (previous.bottom + marker.top) / 2 : -Infinity,
      );
      const bottom = Math.min(
        marker.bottom + radius,
        next ? (marker.bottom + next.top) / 2 : Infinity,
      );
      if (period < 1 || period > MAX_CLASS_PERIOD) {
        excludedBands.push({
          left: marker.left,
          right: nextColumn,
          top,
          bottom,
        });
        continue;
      }
      const inBand = (line: ScheduleOcrLine) => {
        const center = (line.top + line.bottom) / 2;
        return (
          center >= top &&
          center < bottom &&
          line.left > marker.left + height / 2 &&
          line.left < nextColumn - height
        );
      };
      if (
        lines.some(
          (line) => inBand(line) && NON_CLASS_ROW.test(line.text.trim()),
        )
      ) {
        addReading(grouped, period, []);
        continue;
      }
      const metadata = lines.filter(
        (line) => inBand(line) && DETAIL_LINE.test(line.text.trim()),
      );
      const candidates = lines
        .filter((line) => {
          return (
            inBand(line) &&
            !periodLabel(line.text.trim()) &&
            !metadata.some(
              (field) =>
                line.left >= field.left - height / 2 &&
                line.top >= field.top - height / 2,
            )
          );
        })
        .map((line) => ({ line, candidate: meaningfulLine(line.text) }))
        .filter(
          (entry): entry is { line: ScheduleOcrLine; candidate: string } =>
            entry.candidate !== null,
        )
        .sort(
          (left, right) =>
            left.line.top - right.line.top || left.line.left - right.line.left,
        );
      const remainder = periodLabel(marker.label)?.remainder ?? "";
      if (NON_CLASS_ROW.test(remainder)) {
        addReading(grouped, period, []);
        continue;
      }
      const inline = meaningfulLine(remainder);
      const courseLeft = candidates.length
        ? Math.min(...candidates.map(({ line }) => line.left))
        : null;
      const fragments =
        courseLeft === null
          ? []
          : candidates.filter(
              ({ line }) => Math.abs(line.left - courseLeft) <= height,
            );
      const connected: typeof fragments = [];
      for (const fragment of fragments) {
        const last = connected.at(-1);
        if (last && fragment.line.top - last.line.bottom > height * 1.5) break;
        connected.push(fragment);
      }
      if (inline || connected.length) {
        const values = inline
          ? [inline]
          : connected.map(({ candidate }) => candidate);
        addReading(grouped, period, values);
        if (!inline && courseLeft !== null) {
          courseColumns.push({ left: courseLeft, height, top, bottom });
          connected.forEach(({ line }) => used.add(line));
        }
      }
    }
  }
  const unassigned = lines
    .filter(
      (line) =>
        !used.has(line) &&
        !periodLabel(line.text.trim()) &&
        !excludedBands.some(
          (band) =>
            line.left >= band.left &&
            line.left < band.right &&
            (line.top + line.bottom) / 2 >= band.top &&
            (line.top + line.bottom) / 2 < band.bottom,
        ) &&
        courseColumns.some((column) => {
          if (Math.abs(column.left - line.left) > column.height) return false;
          const aligned = courseColumns.filter(
            (other) => Math.abs(other.left - column.left) <= column.height,
          );
          const center = (line.top + line.bottom) / 2;
          return (
            center >= Math.min(...aligned.map((other) => other.top)) &&
            center < Math.max(...aligned.map((other) => other.bottom))
          );
        }),
    )
    .map((line) => meaningfulLine(line.text))
    .filter((text): text is string => text !== null);
  return { readings: grouped, unassigned };
}

function bestCourseMatch(candidates: string[], courses: CourseSummary[]) {
  const ranked: {
    course: CourseSummary;
    confidence: number;
    sourceText: string;
  }[] = [];
  for (const course of courses) {
    let best: (typeof ranked)[number] | null = null;
    for (const candidate of candidates) {
      const confidence = courseMatchScore(candidate, course);
      if (!best || confidence > best.confidence) {
        best = { course, confidence, sourceText: candidate };
      }
    }
    if (best) ranked.push(best);
  }
  ranked.sort((left, right) => right.confidence - left.confidence);
  const [best, runnerUp] = ranked;
  // Similar abbreviated titles need a human choice, not catalog-order luck.
  if (runnerUp && best.confidence - runnerUp.confidence < 0.04) return null;
  return best ?? null;
}

export function parseInfiniteCampusSchedule(
  text: string,
  courses: CourseSummary[],
  ocrLines?: ScheduleOcrLine[],
): OcrScheduleRow[] {
  const lines: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (line) lines.push(line);
  }
  const layoutRows = ocrLines ? rowsFromLayout(ocrLines) : null;
  const grouped: PeriodReadings = new Map();
  let currentPeriod: number | null = null;
  let currentReading: string[] = [];

  for (const line of lines) {
    if (NON_CLASS_ROW.test(line)) {
      currentPeriod = null;
      continue;
    }
    const label = periodLabel(line);
    const period = label?.period ?? 0;
    if (period >= 1 && period <= 12) {
      currentPeriod = period <= MAX_CLASS_PERIOD ? period : null;
      if (currentPeriod === null) continue;
      const remainder = label?.remainder ?? "";
      const meaningfulRemainder = meaningfulLine(remainder);
      currentReading = [];
      addReading(grouped, period, currentReading);
      if (meaningfulRemainder) currentReading.push(meaningfulRemainder);
      continue;
    }

    const candidate = meaningfulLine(line);
    if (currentPeriod && candidate) currentReading.push(candidate);
  }

  // Layout improves associations but must not erase labeled periods that were
  // readable in fullText (for example a number above its course name).
  for (const [period, candidates] of layoutRows?.readings ?? [])
    grouped.set(period, candidates);

  if (grouped.size === 0) {
    const rows: OcrScheduleRow[] = [];
    let skippingNonClass = false;
    for (const line of lines) {
      if (/^9(?:\s|$)/.test(line)) {
        skippingNonClass = true;
        continue;
      }
      if (/^[1-8](?:\s|$)/.test(line)) skippingNonClass = false;
      if (skippingNonClass) continue;
      const candidate = meaningfulLine(line);
      if (!candidate) continue;
      const match = bestCourseMatch([candidate], courses);
      const matchedCourse =
        match && match.confidence >= 0.72 ? match.course : null;
      rows.push({
        id: `unassigned-${rows.length}`,
        // A course-name-only reading has no evidence for its canonical period.
        // It must be assigned explicitly in the review table before it can apply.
        periodNumber: null,
        sourceText: candidate,
        className: matchedCourse?.title ?? candidate,
        matchedCourse,
        confidence: match?.confidence ?? 0,
      });
      if (rows.length >= 12) break;
    }
    return rows;
  }

  const rows: OcrScheduleRow[] = [];
  const groupedEntries = Array.from(grouped.entries()).sort(
    ([left], [right]) => left - right,
  );
  for (const [periodNumber, readings] of groupedEntries) {
    for (const values of readings) {
      const candidates = values.length ? [...values, values.join(" ")] : [];
      const match = bestCourseMatch(candidates, courses);
      const fallbackName = values.join(" ") || `Period ${periodNumber}`;
      const matchedCourse =
        match && match.confidence >= 0.72 ? match.course : null;
      const row = {
        id: `period-${periodNumber}-${rows.length}`,
        periodNumber,
        sourceText: fallbackName,
        className: matchedCourse?.title ?? fallbackName,
        matchedCourse,
        confidence: match?.confidence ?? 0,
      };
      if (
        (row.matchedCourse || row.className !== `Period ${row.periodNumber}`) &&
        !rows.some(
          (existing) =>
            existing.periodNumber === row.periodNumber &&
            existing.className === row.className,
        )
      )
        rows.push(row);
    }
  }
  for (const text of layoutRows?.unassigned ?? []) {
    if (rows.some((row) => normalize(row.sourceText) === normalize(text)))
      continue;
    const match = bestCourseMatch([text], courses);
    const matchedCourse =
      match && match.confidence >= 0.72 ? match.course : null;
    rows.push({
      id: `unassigned-${rows.length}`,
      periodNumber: null,
      sourceText: text,
      className: matchedCourse?.title ?? text,
      matchedCourse,
      confidence: match?.confidence ?? 0,
    });
  }
  return rows;
}
