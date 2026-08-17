import { normalizeCsvRow, normalizeHeader } from "./parse-invite-csv";

export type ClubStructureCsvRow = {
  line: number;
  name: string;
  parent: string;
  kind: string;
};

export function parseClubStructureCsv(text: string): ClubStructureCsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const nameIndex = headers.findIndex((header) => ["name", "unit", "unitname"].includes(header));
  const parentIndex = headers.findIndex((header) => ["parent", "parentunit", "parentunitname"].includes(header));
  const kindIndex = headers.findIndex((header) => ["kind", "type", "unitkind"].includes(header));
  if (nameIndex === -1 || parentIndex === -1) {
    throw new Error("CSV needs `name` and `parent` columns");
  }

  return lines.slice(1).map((line, index) => {
    const cells = splitCsvLine(line);
    const row = normalizeCsvRow({
      [headers[nameIndex]]: cells[nameIndex] ?? "",
      [headers[parentIndex]]: cells[parentIndex] ?? "",
      ...(kindIndex === -1 ? {} : { [headers[kindIndex]]: cells[kindIndex] ?? "" }),
    });
    return {
      line: index + 2,
      name: row[headers[nameIndex]],
      parent: row[headers[parentIndex]],
      kind: kindIndex === -1 ? "" : row[headers[kindIndex]],
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
