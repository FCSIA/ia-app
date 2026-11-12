import { readCsvTable } from "~/apps/shared/csv";

type UnitAssignmentCsvRow = {
  line: number;
  name: string;
  unit: string;
  role: string;
};

/** Parse a CSV with `name` and `unit` headers (and an optional role) for club structure imports. */
export function parseUnitAssignmentCsv(text: string): UnitAssignmentCsvRow[] {
  const { headers, rows } = readCsvTable(text);
  if (headers.length === 0) return [];

  const nameIndex = headers.findIndex((header) =>
    ["name", "studentname", "fullname"].includes(header),
  );
  const unitIndex = headers.findIndex((header) =>
    ["unit", "unitname"].includes(header),
  );
  const roleIndex = headers.findIndex((header) =>
    ["role", "position", "clubrole"].includes(header),
  );
  if (nameIndex === -1 || unitIndex === -1) {
    throw new Error("CSV needs `name` and `unit` columns");
  }

  return rows.map(({ line, cells }) => ({
    line,
    name: cells[nameIndex] ?? "",
    unit: cells[unitIndex] ?? "",
    role: roleIndex === -1 ? "" : cells[roleIndex] ?? "",
  }));
}
