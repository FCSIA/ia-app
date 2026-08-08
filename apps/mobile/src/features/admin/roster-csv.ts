export const MAX_STUDENT_IMPORT_ROWS = 200;

export type StudentPathway =
  | "INFORMATION_TECHNOLOGY"
  | "HEALTH_SCIENCE"
  | "ENGINEERING";

export type StudentImportRow = {
  uniqueId: string;
  firstName: string;
  lastName: string;
  gradeLevel?: number;
  major?: StudentPathway;
  minor?: StudentPathway;
  email?: string;
};

export type CsvIssue = {
  row?: number;
  message: string;
};

export type StudentCsvPreview = {
  rows: StudentImportRow[];
  totalRows: number;
  invalidRows: number;
  issues: CsvIssue[];
  blockingIssues: CsvIssue[];
};

type CanonicalHeader = keyof StudentImportRow;
type CsvRecord = { cells: string[]; line: number };

const HEADER_ALIASES: Record<CanonicalHeader, readonly string[]> = {
  uniqueId: [
    "student id",
    "student number",
    "student no",
    "unique id",
    "unique identifier",
    "student identifier",
    "id",
  ],
  firstName: ["first name", "first", "given name", "forename"],
  lastName: ["last name", "last", "surname", "family name"],
  email: ["email", "email address", "student email"],
  gradeLevel: ["grade", "grade level", "student grade"],
  major: ["major", "major pathway", "primary pathway", "pathway"],
  minor: ["minor", "minor pathway", "minor pathway optional", "secondary pathway"],
};

const REQUIRED_HEADERS = ["uniqueId", "firstName", "lastName"] as const;
const HEADER_LABELS: Record<CanonicalHeader, string> = {
  uniqueId: "Student ID",
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  gradeLevel: "Grade level",
  major: "Major pathway",
  minor: "Minor pathway",
};

const PATHWAYS = new Map<string, StudentPathway>([
  ["it", "INFORMATION_TECHNOLOGY"],
  ["informationtech", "INFORMATION_TECHNOLOGY"],
  ["informationtechnology", "INFORMATION_TECHNOLOGY"],
  ["health", "HEALTH_SCIENCE"],
  ["healthscience", "HEALTH_SCIENCE"],
  ["healthsciences", "HEALTH_SCIENCE"],
  ["engineering", "ENGINEERING"],
  ["engineer", "ENGINEERING"],
  ["stem", "ENGINEERING"],
]);

const HEADER_LOOKUP = new Map<string, CanonicalHeader>(
  Object.entries(HEADER_ALIASES).flatMap(([header, aliases]) =>
    aliases.map((alias) => [normalizeHeader(alias), header as CanonicalHeader] as const),
  ),
);

export function parseStudentCsv(text: string): StudentCsvPreview {
  let records: CsvRecord[];
  try {
    records = parseCsvRecords(text.replace(/^\uFEFF/, ""));
  } catch (error) {
    const issue = {
      message: error instanceof Error ? error.message : "The CSV could not be read.",
    };
    return { rows: [], totalRows: 0, invalidRows: 0, issues: [issue], blockingIssues: [issue] };
  }

  const nonEmptyRecords = records.filter((record) => record.cells.some((cell) => cell.trim()));
  if (nonEmptyRecords.length === 0) {
    const issue = { message: "The CSV is empty." };
    return { rows: [], totalRows: 0, invalidRows: 0, issues: [issue], blockingIssues: [issue] };
  }

  const [headerRecord, ...dataRecords] = nonEmptyRecords;
  const headerIndexes = new Map<CanonicalHeader, number>();
  const blockingIssues: CsvIssue[] = [];

  headerRecord.cells.forEach((rawHeader, index) => {
    const canonical = HEADER_LOOKUP.get(normalizeHeader(rawHeader));
    if (!canonical) return;
    if (headerIndexes.has(canonical)) {
      blockingIssues.push({
        row: headerRecord.line,
        message: `More than one column matches ${HEADER_LABELS[canonical]}.`,
      });
      return;
    }
    headerIndexes.set(canonical, index);
  });

  for (const required of REQUIRED_HEADERS) {
    if (!headerIndexes.has(required)) {
      blockingIssues.push({
        row: headerRecord.line,
        message: `Missing required ${HEADER_LABELS[required]} column.`,
      });
    }
  }

  if (dataRecords.length === 0) {
    blockingIssues.push({ message: "The CSV has headers but no student rows." });
  }
  if (dataRecords.length > MAX_STUDENT_IMPORT_ROWS) {
    blockingIssues.push({
      message: `This file has ${dataRecords.length} rows. Import at most ${MAX_STUDENT_IMPORT_ROWS} at a time.`,
    });
  }

  const rows: StudentImportRow[] = [];
  const issues: CsvIssue[] = [];
  const seenIds = new Set<string>();
  let invalidRows = 0;

  if (REQUIRED_HEADERS.every((header) => headerIndexes.has(header))) {
    for (const record of dataRecords) {
      const rowIssues: CsvIssue[] = [];
      const value = (header: CanonicalHeader) => {
        const index = headerIndexes.get(header);
        return index == null ? "" : (record.cells[index] ?? "").trim();
      };

      const uniqueId = value("uniqueId").normalize("NFKC").toUpperCase();
      const firstName = value("firstName");
      const lastName = value("lastName");
      const email = value("email");
      const grade = value("gradeLevel");
      const majorValue = value("major");
      const minorValue = value("minor");

      if (!uniqueId) rowIssues.push({ row: record.line, message: "Student ID is required." });
      if (!firstName) rowIssues.push({ row: record.line, message: "First name is required." });
      if (!lastName) rowIssues.push({ row: record.line, message: "Last name is required." });
      if (uniqueId && seenIds.has(uniqueId)) {
        rowIssues.push({ row: record.line, message: "A student ID appears more than once in this file." });
      }
      if (email && !/^[^\s@]+@[^\s@]+$/.test(email)) {
        rowIssues.push({ row: record.line, message: `Email “${email}” is not valid.` });
      }

      let gradeLevel: number | undefined;
      if (grade) {
        const parsedGrade = Number(grade);
        if (!Number.isInteger(parsedGrade) || parsedGrade < 9 || parsedGrade > 12) {
          rowIssues.push({ row: record.line, message: "Grade level must be a whole number from 9 to 12." });
        } else {
          gradeLevel = parsedGrade;
        }
      }

      const major = parsePathway(majorValue);
      const minor = parsePathway(minorValue);
      if (majorValue && !major) {
        rowIssues.push({ row: record.line, message: `Major pathway “${majorValue}” is not recognized.` });
      }
      if (minorValue && !minor) {
        rowIssues.push({ row: record.line, message: `Minor pathway “${minorValue}” is not recognized.` });
      }
      if (major && minor && major === minor) {
        rowIssues.push({ row: record.line, message: "Major and minor pathways must be different." });
      }

      const trailingCells = record.cells.slice(headerRecord.cells.length);
      if (trailingCells.some((cell) => cell.trim())) {
        rowIssues.push({ row: record.line, message: "This row has values beyond the last header." });
      }

      if (rowIssues.length) {
        invalidRows += 1;
        issues.push(...rowIssues);
        continue;
      }

      seenIds.add(uniqueId);
      rows.push({
        uniqueId,
        firstName,
        lastName,
        ...(email ? { email: email.toLowerCase() } : {}),
        ...(gradeLevel == null ? {} : { gradeLevel }),
        ...(major ? { major } : {}),
        ...(minor ? { minor } : {}),
      });
    }
  } else {
    invalidRows = dataRecords.length;
  }

  return {
    rows,
    totalRows: dataRecords.length,
    invalidRows,
    issues: [...blockingIssues, ...issues],
    blockingIssues,
  };
}

export function buildStudentExportCsv(
  students: readonly {
    firstName: string;
    lastName: string;
    uniqueId: string;
    email: string;
    gradeLevel: number | null;
    major: string | null;
    minor: string | null;
  }[],
) {
  return buildCsv(
    ["first_name", "last_name", "student_id", "email", "grade_level", "major_pathway", "minor_pathway"],
    students.map((student) => [
      student.firstName,
      student.lastName,
      student.uniqueId,
      student.email,
      student.gradeLevel ?? "",
      student.major ?? "",
      student.minor ?? "",
    ]),
  );
}

export function buildCredentialsCsv(
  credentials: readonly {
    firstName: string;
    lastName: string;
    uniqueId: string;
    email: string;
    temporaryPassword: string;
  }[],
) {
  return buildCsv(
    ["first_name", "last_name", "student_id", "email", "temporary_password"],
    credentials.map((student) => [
      student.firstName,
      student.lastName,
      student.uniqueId,
      student.email,
      student.temporaryPassword,
    ]),
  );
}

function parseCsvRecords(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;

  const finishRecord = () => {
    cells.push(cell);
    records.push({ cells, line: recordLine });
    cells = [];
    cell = "";
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else if (inQuotes) {
        inQuotes = false;
      } else if (!cell.trim()) {
        cell = "";
        inQuotes = true;
      } else {
        cell += char;
      }
      continue;
    }

    const isNewline = char === "\n" || char === "\r";
    if (isNewline) {
      if (inQuotes) {
        cell += "\n";
      } else {
        finishRecord();
      }
      if (char === "\r" && next === "\n") index += 1;
      line += 1;
      if (!inQuotes) recordLine = line;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(cell);
      cell = "";
      continue;
    }

    cell += char;
  }

  if (inQuotes) {
    throw new Error(`A quoted value beginning on line ${recordLine} is not closed.`);
  }
  if (cell.length || cells.length) finishRecord();
  return records;
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parsePathway(value: string): StudentPathway | undefined {
  if (!value) return undefined;
  return PATHWAYS.get(normalizeHeader(value));
}

function buildCsv(headers: readonly string[], rows: readonly (readonly (string | number)[])[]) {
  return [headers, ...rows]
    .map((row) => row.map((value) => escapeCsvCell(String(value))).join(","))
    .join("\r\n");
}

function escapeCsvCell(value: string) {
  const spreadsheetSafe = /^[\t ]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${spreadsheetSafe.replace(/"/g, '""')}"`;
}
