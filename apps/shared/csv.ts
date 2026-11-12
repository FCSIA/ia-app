export type CsvRecord = { line: number; cells: string[] };

/** Lowercase letters and digits only, so "Unit Name" and "unit_name" match. */
export function normalizeCsvHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Reads quoted fields, escaped quotes, CRLF and newlines inside quoted fields.
 * Cells are trimmed and blank records are dropped. Malformed quoting throws an
 * error naming the line.
 */
export function readCsv(text: string): CsvRecord[] {
  const result: CsvRecord[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let closedQuote = false;
  let line = 1;
  let recordLine = 1;
  const source = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
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

/** A CSV with a header row: normalized header names and the data records under them. */
export function readCsvTable(text: string) {
  const [header, ...rows] = readCsv(text);
  return { headers: (header?.cells ?? []).map(normalizeCsvHeader), rows };
}

/** A CSV cell quoted only where a comma, quote, or line break needs it. */
export function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A CSV document with one header row and a trailing newline. */
export function writeCsv(
  columns: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>,
) {
  return [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}
