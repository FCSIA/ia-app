/** Local CSV review. No row is sent to the server until the whole preview is valid. */
export type RosterCsvPreview<T> = {
  headers: string[];
  rows: Array<{ line: number; cells: string[]; value?: T; issues: string[] }>;
  issues: string[];
};

export const normalizeRosterHeader = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');
export const rosterCell = (row: Record<string, string>, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[normalizeRosterHeader(key)];
    if (value) return value;
  }
  return undefined;
};

/** Read quoted fields, escaped quotes, CRLF, and newlines inside quoted fields. */
function records(text: string) {
  const result: Array<{ line: number; cells: string[] }> = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let closedQuote = false;
  let line = 1;
  let recordLine = 1;
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const finish = () => {
    cells.push(cell.trim());
    if (cells.some(Boolean)) result.push({ line: recordLine, cells });
    cells = [];
    cell = '';
    closedQuote = false;
  };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (quoted) {
        quoted = false;
        closedQuote = true;
      } else if (!cell.trim() && !closedQuote) quoted = true;
      else
        throw new Error(
          `Line ${recordLine}: a quote must start a field or escape another quote.`,
        );
    } else if (char === ',' && !quoted) {
      cells.push(cell.trim());
      cell = '';
      closedQuote = false;
    } else if (char === '\n') {
      if (quoted) cell += char;
      else {
        finish();
        recordLine = line + 1;
      }
      line += 1;
    } else if (closedQuote && char?.trim())
      throw new Error(
        `Line ${recordLine}: unexpected text after a closing quote.`,
      );
    else cell += char;
  }
  if (quoted)
    throw new Error(
      `Line ${recordLine}: a quoted field is missing its closing quote.`,
    );
  finish();
  return result;
}

export function reviewRosterCsv<T extends { uniqueId: string }>(
  text: string,
  required: Array<{ label: string; aliases: string[] }>,
  parse: (row: Record<string, string>, issues: string[]) => T,
  validateHeaders?: (headers: string[]) => string | undefined,
): RosterCsvPreview<T> {
  let parsed: ReturnType<typeof records>;
  try {
    parsed = records(text);
  } catch (error) {
    return {
      headers: [],
      rows: [],
      issues: [error instanceof Error ? error.message : 'Could not read CSV.'],
    };
  }
  const headers = parsed[0]?.cells ?? [];
  const normalized = headers.map(normalizeRosterHeader);
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
          normalized.includes(normalizeRosterHeader(alias)),
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
