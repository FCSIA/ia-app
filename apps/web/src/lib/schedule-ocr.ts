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
  /^(?:sss(?:\s*\/\s*flex)?|flex(?:\s*\/\s*student success skills)?|lunch)\b/i;

const PERIOD_WITH_LABEL = /\b(?:period|per\.?|p)\s*#?\s*(\d{1,2})\b/i;
const LEADING_PERIOD =
  /^\s*(\d{1,2})\s*(?:st|nd|rd|th)?\s*(?:period|[-|])\s*(.*)$/i;
const LEADING_NUMBER = /^\s*(\d{1,2})\s+([^:]{3,})$/;
const BARE_PERIOD = /^\s*(\d{1,2})\s*$/;
const IGNORED_LINE =
  /^(?:schedule|calendar|term|quarter|semester|teacher|room|attendance|grades?|today|day|week|agenda|no scheduled course)$/i;
const DETAIL_LINE = /^(?:teacher|instructor|room|staff|start|end|time)\b/i;
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
  if (normalizedCandidate.includes(normalizedTitle)) return 0.99;
  if (
    normalizedTitle.includes(normalizedCandidate) &&
    normalizedCandidate.length >= 6
  ) {
    return 0.9;
  }
  if (
    normalizedTitle.startsWith(normalizedCandidate) &&
    normalizedCandidate.length >= 4
  ) {
    return 0.84;
  }
  if (
    course.courseNumbers.some((number) => {
      const normalizedNumber = normalize(number);
      return (
        normalizedNumber.length >= 3 &&
        normalizedCandidate.includes(normalizedNumber)
      );
    })
  ) {
    return 0.92;
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
    .replace(/\s+(?:teacher|room|start):.*$/i, "")
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
      period: Number(line.text.match(/^([1-9])(?:\s|$)/)?.[1] ?? 0),
    }))
    .filter((line) => line.period > 0 || /^sss\s*\/\s*flex\b/i.test(line.label))
    .sort((left, right) => left.top - right.top);
  if (
    markers.filter((line) => line.period >= 1 && line.period <= 8).length < 2
  ) return null;

  const grouped = new Map<number, string[]>();
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    const period = marker.period;
    if (period < 1 || period > MAX_CLASS_PERIOD) continue;
    const previous = markers[index - 1];
    const next = markers[index + 1];
    const top = previous ? (previous.bottom + marker.top) / 2 : marker.top - 50;
    const bottom = next ? (marker.bottom + next.top) / 2 : marker.bottom + 70;
    const candidates = lines
      .filter((line) => {
        const center = (line.top + line.bottom) / 2;
        return (
          !(line.left === marker.left && line.top === marker.top && line.text === marker.text) &&
          center >= top && center < bottom && line.left > marker.left + 35
        );
      })
      .map((line) => ({ line, candidate: meaningfulLine(line.text) }))
      .filter((entry): entry is { line: ScheduleOcrLine; candidate: string } =>
        entry.candidate !== null,
      )
      .sort(
        (left, right) =>
          left.line.left - right.line.left || left.line.top - right.line.top,
      );
    const inline = meaningfulLine(marker.label.replace(/^[1-9]\s*/, ""));
    if (inline) grouped.set(period, [inline]);
    else if (candidates.length) grouped.set(period, [candidates[0].candidate]);
  }
  return grouped;
}

function bestCourseMatch(candidates: string[], courses: CourseSummary[]) {
  let best: {
    course: CourseSummary;
    confidence: number;
    sourceText: string;
  } | null = null;
  for (const candidate of candidates) {
    for (const course of courses) {
      const confidence = courseMatchScore(candidate, course);
      if (!best || confidence > best.confidence) {
        best = { course, confidence, sourceText: candidate };
      }
    }
  }
  return best;
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
  const grouped = layoutRows ?? new Map<number, string[]>();
  let currentPeriod: number | null = null;

  for (const line of layoutRows ? [] : lines) {
    if (NON_CLASS_ROW.test(line)) {
      currentPeriod = null;
      continue;
    }
    const labeledMatch = line.match(PERIOD_WITH_LABEL);
    const leadingMatch =
      line.match(LEADING_PERIOD) ?? line.match(LEADING_NUMBER) ?? line.match(BARE_PERIOD);
    const period = Number(labeledMatch?.[1] ?? leadingMatch?.[1] ?? 0);
    if (period >= 1 && period <= 12) {
      currentPeriod = period <= MAX_CLASS_PERIOD ? period : null;
      if (currentPeriod === null) continue;
      const remainder = line
        .replace(PERIOD_WITH_LABEL, "")
        .replace(LEADING_PERIOD, "$2")
        .replace(LEADING_NUMBER, "$2")
        .replace(BARE_PERIOD, "")
        .replace(/^\s*[-:|]+\s*/, "")
        .trim();
      const meaningfulRemainder = meaningfulLine(remainder);
      if (!grouped.has(period)) grouped.set(period, []);
      if (meaningfulRemainder) grouped.get(period)?.push(meaningfulRemainder);
      continue;
    }

    const candidate = meaningfulLine(line);
    if (currentPeriod && candidate) grouped.get(currentPeriod)?.push(candidate);
  }

  if (grouped.size === 0) {
    const rows: OcrScheduleRow[] = [];
    let skippingNonClass = false;
    for (const line of lines) {
      if (NON_CLASS_ROW.test(line) || /^9(?:\s|$)/.test(line)) {
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
  for (const [periodNumber, values] of groupedEntries) {
    const candidates = values.length ? [...values, values.join(" ")] : [];
    const match = bestCourseMatch(candidates, courses);
    const fallbackName = values[0] ?? `Period ${periodNumber}`;
    const matchedCourse =
      match && match.confidence >= 0.56 ? match.course : null;
    const row = {
      id: `period-${periodNumber}`,
      periodNumber,
      sourceText: match?.sourceText ?? fallbackName,
      className: matchedCourse?.title ?? fallbackName,
      matchedCourse,
      confidence: match?.confidence ?? 0,
    };
    if (row.matchedCourse || row.className !== `Period ${row.periodNumber}`)
      rows.push(row);
  }
  return rows;
}
