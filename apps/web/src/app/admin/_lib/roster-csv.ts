import { normalizeCsvHeader, readCsv } from '@/lib/csv';

/** Local CSV review. No row is sent to the server until the whole preview is valid. */
export type RosterCsvPreview<T> = {
  headers: string[];
  rows: Array<{ line: number; cells: string[]; value?: T; issues: string[] }>;
  issues: string[];
};

export const rosterCell = (row: Record<string, string>, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[normalizeCsvHeader(key)];
    if (value) return value;
  }
  return undefined;
};

export function reviewRosterCsv<T extends { uniqueId: string }>(
  text: string,
  required: Array<{ label: string; aliases: string[] }>,
  parse: (row: Record<string, string>, issues: string[]) => T,
  validateHeaders?: (headers: string[]) => string | undefined,
): RosterCsvPreview<T> {
  let parsed: ReturnType<typeof readCsv>;
  try {
    parsed = readCsv(text);
  } catch (error) {
    return {
      headers: [],
      rows: [],
      issues: [error instanceof Error ? error.message : 'Could not read CSV.'],
    };
  }
  const headers = parsed[0]?.cells ?? [];
  const normalized = headers.map(normalizeCsvHeader);
  const issues: string[] = [];
  if (!headers.length)
    issues.push('Choose a CSV with a header row and at least one data row.');
  else {
    if (normalized.some((header) => !header))
      issues.push('Every column needs a header.');
    if (new Set(normalized).size !== normalized.length)
      issues.push('Column headers must be unique.');
    for (const field of required) {
      if (
        !field.aliases.some((alias) =>
          normalized.includes(normalizeCsvHeader(alias)),
        )
      )
        issues.push(`CSV must include a ${field.label} column.`);
    }
    const headerIssue = validateHeaders?.(normalized);
    if (headerIssue) issues.push(headerIssue);
    if (parsed.length < 2) issues.push('The CSV has no data rows.');
    if (parsed.length > 201)
      issues.push(
        'Review at most 200 records at a time. Split this CSV before continuing.',
      );
  }
  const seen = new Map<string, number>();
  const rows = parsed.slice(1).map(({ line, cells }) => {
    const rowIssues: string[] = [];
    if (cells.length !== headers.length)
      rowIssues.push(
        `Expected ${headers.length} columns; found ${cells.length}.`,
      );
    const raw = Object.fromEntries(
      normalized.map((header, index) => [header, cells[index] ?? '']),
    );
    const value = parse(raw, rowIssues);
    const id = value.uniqueId.trim().toUpperCase();
    if (id) {
      if (seen.has(id))
        rowIssues.push(`Duplicate ID; first appears on line ${seen.get(id)}.`);
      else seen.set(id, line);
    }
    return { line, cells, value, issues: rowIssues };
  });
  return { headers, rows, issues };
}

export function validRosterRows<T>(preview: RosterCsvPreview<T>): T[] {
  const firstIssue =
    preview.issues[0] ??
    preview.rows.find((row) => row.issues.length)?.issues[0];
  if (firstIssue) throw new Error(firstIssue);
  return preview.rows.flatMap((row) =>
    row.value === undefined ? [] : [row.value],
  );
}

export function canSubmitRoster<T>(preview: RosterCsvPreview<T> | null) {
  return (
    !!preview &&
    preview.rows.length > 0 &&
    preview.issues.length === 0 &&
    preview.rows.every(
      (row) => row.issues.length === 0 && row.value !== undefined,
    )
  );
}
