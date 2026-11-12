import { readCsvTable } from "~/apps/shared/csv";

type ClubStructureCsvRow = {
  line: number;
  name: string;
  parent: string;
  kind: string;
};

export function parseClubStructureCsv(text: string): ClubStructureCsvRow[] {
  const { headers, rows } = readCsvTable(text);
  if (headers.length === 0) return [];

  const nameIndex = headers.findIndex((header) => ["name", "unit", "unitname"].includes(header));
  const parentIndex = headers.findIndex((header) => ["parent", "parentunit", "parentunitname"].includes(header));
  const kindIndex = headers.findIndex((header) => ["kind", "type", "unitkind"].includes(header));
  if (nameIndex === -1 || parentIndex === -1) {
    throw new Error("CSV needs `name` and `parent` columns");
  }

  return rows.map(({ line, cells }) => ({
    line,
    name: cells[nameIndex] ?? "",
    parent: cells[parentIndex] ?? "",
    kind: kindIndex === -1 ? "" : cells[kindIndex] ?? "",
  }));
}
