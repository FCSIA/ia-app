import { readCsvTable } from './csv';

const IDENTIFIER_COLUMNS = ['uniqueid', 'studentid', 'userid', 'recipientid', 'id'];

function extractInviteIdentifier(row: Record<string, string>) {
  for (const column of IDENTIFIER_COLUMNS) {
    const value = row[column];
    if (value) return value;
  }

  const values = Object.values(row).filter(Boolean);
  if (values.length === 1) return values[0];
  return undefined;
}

/** The student or user ID in each row of an invite upload. */
export function parseInviteCsv(text: string): string[] {
  const { headers, rows } = readCsvTable(text);
  const identifiers: string[] = [];

  for (const { cells } of rows) {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    const identifier = extractInviteIdentifier(row);
    if (identifier) identifiers.push(identifier);
  }

  return identifiers;
}
