/** Parse club invite CSV files client-side (unique ID column). */
export function normalizeHeader(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function normalizeCsvRow(row: Record<string, unknown>) {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeHeader(key)] =
      typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  }
  return normalized;
}

export function extractInviteIdentifier(row: Record<string, string>) {
  const candidates = [
    'uniqueid',
    'studentid',
    'userid',
    'recipientid',
    'id',
  ];

  for (const candidate of candidates) {
    const value = row[candidate];
    if (value) return value;
  }

  const values = Object.values(row).filter(Boolean);
  if (values.length === 1) return values[0];
  return undefined;
}

/** Minimal RFC4180-style CSV parse for invite uploads. */
export function parseInviteCsv(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]).map((cell) => normalizeHeader(cell));
  const identifiers: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    const identifier = extractInviteIdentifier(normalizeCsvRow(row));
    if (identifier) identifiers.push(identifier);
  }

  return identifiers;
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}
