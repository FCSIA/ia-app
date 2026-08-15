import { normalizeCsvRow, normalizeHeader } from "./parse-invite-csv";

export type UnitAssignmentCsvRow = {
  line: number;
  name: string;
  unit: string;
};

/** Parse a two-column CSV with `name` and `unit` headers for club structure imports. */
export function parseUnitAssignmentCsv(text: string): UnitAssignmentCsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const nameIndex = headers.findIndex((header) =>
    ["name", "studentname", "fullname"].includes(header),
  );
  const unitIndex = headers.findIndex((header) =>
    ["unit", "unitname"].includes(header),
  );
  if (nameIndex === -1 || unitIndex === -1) {
    throw new Error("CSV needs `name` and `unit` columns");
  }

  return lines.slice(1).map((line, index) => {
    const cells = splitCsvLine(line);
    const row = normalizeCsvRow({
      [headers[nameIndex]]: cells[nameIndex] ?? "",
      [headers[unitIndex]]: cells[unitIndex] ?? "",
    });
    return {
      line: index + 2,
      name: row[headers[nameIndex]],
      unit: row[headers[unitIndex]],
    };
  });
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}
