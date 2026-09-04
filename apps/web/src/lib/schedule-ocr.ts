import type { CourseSummary } from '@/components/courses/types';

export type OcrScheduleRow = {
  periodNumber: number;
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

const PERIOD_WITH_LABEL = /\b(?:period|per\.?|p)\s*#?\s*(\d{1,2})\b/i;
const LEADING_PERIOD = /^\s*(\d{1,2})\s*(?:st|nd|rd|th)?\s*(?:period|[-|])\s*(.*)$/i;
const IGNORED_LINE = /^(?:schedule|calendar|term|quarter|semester|teacher|room|attendance|grades?|today|day|week|agenda|no scheduled course)$/i;
const DETAIL_LINE = /^(?:teacher|instructor|room|staff|start|end|time)\b/i;
const WEEKDAY_LINE = /^(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i;
const TIME_LINE = /^\d{1,2}:\d{2}\s*(?:am|pm)?(?:\s*[-–]\s*\d{1,2}:\d{2}\s*(?:am|pm)?)?$/i;

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function bigrams(value: string) {
  const compact = normalize(value).replace(/\s/g, '');
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
  if (normalizedTitle.includes(normalizedCandidate) && normalizedCandidate.length >= 6) {
    return 0.9;
  }
  if (normalizedTitle.startsWith(normalizedCandidate) && normalizedCandidate.length >= 4) {
    return 0.84;
  }
  if (
    course.courseNumbers.some((number) => {
      const normalizedNumber = normalize(number);
      return normalizedNumber.length >= 3 && normalizedCandidate.includes(normalizedNumber);
    })
  ) {
    return 0.92;
  }

  const candidateTokens = new Set(normalizedCandidate.split(' ').filter((token) => token.length > 1));
  const titleTokens = new Set(normalizedTitle.split(' ').filter((token) => token.length > 1));
  const tokenScore = overlapScore(candidateTokens, titleTokens);
  const bigramScore = overlapScore(bigrams(normalizedCandidate), bigrams(normalizedTitle));
  return tokenScore * 0.62 + bigramScore * 0.38;
}

function meaningfulLine(value: string) {
  const line = value.replace(/\s+/g, ' ').trim();
  if (
    line.length < 3 ||
    IGNORED_LINE.test(line) ||
    DETAIL_LINE.test(line) ||
    WEEKDAY_LINE.test(line) ||
    TIME_LINE.test(line)
  ) {
    return null;
  }
  return line;
}

function bestCourseMatch(candidates: string[], courses: CourseSummary[]) {
  let best: { course: CourseSummary; confidence: number; sourceText: string } | null = null;
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

function cleanLineDetails(value: string) {
  return value
    .replace(/\b(?:teacher|instructor|staff|room|start|end):\s*[^,\n]+(?:,\s*[^,\n]+)*/gi, '')
    .replace(/\b\d{1,2}:\d{2}\s*(?:am|pm)?(?:\s*[-–]\s*\d{1,2}:\d{2}\s*(?:am|pm)?)?/gi, '')
    .replace(/\b(?:term\s*\d|quarter\s*\d|sem(?:ester)?\s*\d)\b/gi, '')
    .replace(/[()[\]{}|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isDetailOrJunk(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^([1-9]|1[0-2])$/.test(trimmed)) return false;
  if (trimmed.length < 2) return true;
  if (/^(?:teacher|instructor|room|staff|start|end|time)\b/i.test(trimmed)) return true;
  if (/^\d{1,2}:\d{2}\s*(?:am|pm)?(?:\s*[-–]\s*\d{1,2}:\d{2}\s*(?:am|pm)?)?$/i.test(trimmed)) return true;
  if (/^(?:mon|tue|wed|thu|fri|sat|sun)(?:sday|day|nesday|rsday)?\b/i.test(trimmed)) return true;
  if (/^(?:schedule|calendar|term|quarter|semester|attendance|grades?|today|day|week|agenda|no scheduled course)$/i.test(trimmed)) return true;
  return false;
}

export function parseInfiniteCampusSchedule(
  text: string,
  courses: CourseSummary[],
): OcrScheduleRow[] {
  const lines: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (line && !isDetailOrJunk(line)) lines.push(line);
  }
  const grouped = new Map<number, string[]>();
  let currentPeriod: number | null = null;

  const LEADING_NUMBER = /^(\d{1,2})\b(?:\s*[-.)|]\s*|\s+)(.*)$/;
  const STANDALONE_NUMBER = /^(\d{1,2})$/;

  for (const line of lines) {
    const labeledMatch = line.match(PERIOD_WITH_LABEL);
    const leadingMatch = line.match(LEADING_PERIOD) ?? line.match(LEADING_NUMBER);
    const standaloneMatch = line.match(STANDALONE_NUMBER);

    if (labeledMatch || leadingMatch) {
      const period = Number(labeledMatch?.[1] ?? leadingMatch?.[1] ?? 0);
      if (period >= 1 && period <= 12) {
        currentPeriod = period;
        const remainderRaw = line
          .replace(PERIOD_WITH_LABEL, '')
          .replace(LEADING_PERIOD, '$2')
          .replace(LEADING_NUMBER, '$2')
          .replace(/^\s*[-:|]+\s*/, '')
          .trim();
        const cleanedRemainder = cleanLineDetails(remainderRaw);
        const meaningfulRemainder = meaningfulLine(cleanedRemainder);
        if (!grouped.has(period)) grouped.set(period, []);
        if (meaningfulRemainder) grouped.get(period)?.push(meaningfulRemainder);
        continue;
      }
    } else if (standaloneMatch) {
      const period = Number(standaloneMatch[1]);
      if (period >= 1 && period <= 12) {
        currentPeriod = period;
        if (!grouped.has(period)) grouped.set(period, []);
        continue;
      }
    }

    const cleaned = cleanLineDetails(line);
    const candidate = meaningfulLine(cleaned);
    if (currentPeriod && candidate) {
      grouped.get(currentPeriod)?.push(candidate);
    }
  }

  if (grouped.size === 0) {
    const seen = new Set<string>();
    const rows: OcrScheduleRow[] = [];
    for (const line of lines) {
      const cleaned = cleanLineDetails(line);
      const match = bestCourseMatch([cleaned || line], courses);
      const isConfidentMatch = match && match.confidence >= 0.72;
      
      if (isConfidentMatch && seen.has(match.course.id)) continue;
      if (isConfidentMatch) seen.add(match.course.id);
      
      rows.push({
        periodNumber: rows.length + 1,
        sourceText: cleaned || line,
        className: isConfidentMatch ? match.course.title : (cleaned || line),
        matchedCourse: isConfidentMatch ? match.course : null,
        confidence: match ? match.confidence : 0,
      });
      if (rows.length >= 12) break;
    }
    return rows;
  }

  const rows: OcrScheduleRow[] = [];
  const groupedEntries = Array.from(grouped.entries()).sort(([left], [right]) => left - right);
  for (const [periodNumber, values] of groupedEntries) {
    const filteredValues = values.filter((v) => v.length >= 3);
    const candidates = filteredValues.length ? [...filteredValues, filteredValues.join(' ')] : [];
    const match = bestCourseMatch(candidates, courses);
    const fallbackName = filteredValues[0] ?? `Period ${periodNumber}`;
    const matchedCourse = match && match.confidence >= 0.56 ? match.course : null;
    const row = {
      periodNumber,
      sourceText: match?.sourceText ?? fallbackName,
      className: matchedCourse?.title ?? fallbackName,
      matchedCourse,
      confidence: match?.confidence ?? 0,
    };
    if (row.matchedCourse || row.className !== `Period ${row.periodNumber}`) rows.push(row);
  }
  return rows;
}
