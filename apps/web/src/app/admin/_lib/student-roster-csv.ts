import type { FunctionArgs } from 'convex/server';
import { api } from '~/apps/convex/src/_generated/api';

type StudentImportRow = FunctionArgs<typeof api.users.admin.importStudents>['rows'][number];
export type StudentBulkUpdateRow = FunctionArgs<typeof api.users.admin.updateStudents>['rows'][number];

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function pick(row: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeHeader(key)];
    if (value) return value;
  }
  return undefined;
}

function pathway(value: string, rowNumber: number, column: string) {
  const map: Record<string, StudentImportRow['major']> = {
    it: 'INFORMATION_TECHNOLOGY',
    informationtechnology: 'INFORMATION_TECHNOLOGY',
    healthscience: 'HEALTH_SCIENCE',
    engineering: 'ENGINEERING',
    stem: 'ENGINEERING',
    business: 'INFORMATION_TECHNOLOGY',
    arts: 'HEALTH_SCIENCE',
  };
  const parsed = map[normalizeHeader(value)];
  if (!parsed) throw new Error(`Row ${rowNumber}: ${column} must be IT, Health Science, or Engineering.`);
  return parsed;
}

export function parseStudentImportCsv(text: string): StudentImportRow[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]!).map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
    const gradeValue = pick(row, 'grade level', 'grade_level', 'gradeLevel', 'grade');
    const gradeLevel = gradeValue ? Number.parseInt(gradeValue, 10) : undefined;
    return {
      uniqueId: pick(row, 'student id', 'student_id', 'studentId', 'unique id', 'unique_id', 'id') ?? '',
      firstName: pick(row, 'first name', 'first_name', 'firstName', 'first') ?? '',
      lastName: pick(row, 'last name', 'last_name', 'lastName', 'last') ?? '',
      email: pick(row, 'email', 'student email'),
      gradeLevel: Number.isInteger(gradeLevel) ? gradeLevel : undefined,
      major: (() => {
        const value = pick(row, 'major pathway', 'major_pathway', 'majorPathway', 'pathway', 'major');
        return value ? pathway(value, 0, 'major pathway') : undefined;
      })(),
      minor: (() => {
        const value = pick(row, 'minor pathway', 'minor_pathway', 'minorPathway', 'minor');
        return value ? pathway(value, 0, 'minor pathway') : undefined;
      })(),
    };
  });
}

export function parseStudentBulkUpdateCsv(text: string): StudentBulkUpdateRow[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]!).map(normalizeHeader);
  const studentIdIndex = headers.findIndex((header) => ['studentid', 'uniqueid', 'id'].includes(header));
  if (studentIdIndex < 0) throw new Error('CSV must include a student_id column.');

  const gradeIndex = headers.findIndex((header) => ['gradelevel', 'grade'].includes(header));
  const majorIndex = headers.findIndex((header) => ['majorpathway', 'pathway', 'major'].includes(header));
  const minorIndex = headers.findIndex((header) => ['minorpathway', 'minor'].includes(header));
  if (gradeIndex < 0 && majorIndex < 0 && minorIndex < 0) {
    throw new Error('CSV must include grade_level, major_pathway, or minor_pathway.');
  }

  return lines.slice(1).map((line, index) => {
    const rowNumber = index + 2;
    const cells = parseCsvLine(line);
    const uniqueId = cells[studentIdIndex]?.trim() ?? '';
    if (!uniqueId) throw new Error(`Row ${rowNumber}: student ID is required.`);

    const row: StudentBulkUpdateRow = { uniqueId };
    if (gradeIndex >= 0) {
      const value = cells[gradeIndex]?.trim() ?? '';
      if (!value) {
        row.gradeLevel = null;
      } else {
        const gradeLevel = Number.parseInt(value, 10);
        if (!Number.isInteger(gradeLevel) || gradeLevel < 9 || gradeLevel > 12) {
          throw new Error(`Row ${rowNumber}: grade level must be a number from 9 to 12.`);
        }
        row.gradeLevel = gradeLevel;
      }
    }
    if (majorIndex >= 0) {
      const value = cells[majorIndex]?.trim() ?? '';
      row.major = value ? pathway(value, rowNumber, 'major pathway') : null;
    }
    if (minorIndex >= 0) {
      const value = cells[minorIndex]?.trim() ?? '';
      row.minor = value ? pathway(value, rowNumber, 'minor pathway') : null;
    }
    return row;
  });
}
