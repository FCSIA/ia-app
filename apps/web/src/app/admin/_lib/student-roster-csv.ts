import type { FunctionArgs } from 'convex/server';
import { api } from '~/apps/convex/src/_generated/api';
import {
  normalizeRosterHeader,
  reviewRosterCsv,
  rosterCell,
  validRosterRows,
} from './roster-csv';

export type StudentImportRow = FunctionArgs<
  typeof api.users.admin.importStudents
>['rows'][number];
export type StudentBulkUpdateRow = FunctionArgs<
  typeof api.users.admin.updateStudents
>['rows'][number];
const idAliases = ['student id', 'unique id', 'id'];
const gradeAliases = ['grade level', 'grade'];
const majorAliases = ['major pathway', 'pathway', 'major'];
const minorAliases = ['minor pathway', 'minor'];

function pathway(value: string | undefined, column: string, issues: string[]) {
  if (!value) return undefined;
  const map: Record<string, StudentImportRow['major']> = {
    it: 'INFORMATION_TECHNOLOGY',
    informationtechnology: 'INFORMATION_TECHNOLOGY',
    healthscience: 'HEALTH_SCIENCE',
    engineering: 'ENGINEERING',
    stem: 'ENGINEERING',
    business: 'INFORMATION_TECHNOLOGY',
    arts: 'HEALTH_SCIENCE',
  };
  const parsed = map[normalizeRosterHeader(value)];
  if (!parsed)
    issues.push(`${column} must be IT, Health Science, or Engineering.`);
  return parsed;
}
function grade(value: string | undefined, issues: string[]) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (
    !/^\d+$/.test(value) ||
    !Number.isInteger(parsed) ||
    parsed < 9 ||
    parsed > 12
  ) {
    issues.push('Grade level must be a whole number from 9 to 12.');
    return undefined;
  }
  return parsed;
}
function studentId(row: Record<string, string>, issues: string[]) {
  const id = rosterCell(row, ...idAliases) ?? '';
  if (!id) issues.push('Student ID is required.');
  else if (id.length < 3)
    issues.push('Student ID must contain at least 3 characters.');
  return id;
}

export function previewStudentImportCsv(text: string) {
  return reviewRosterCsv<StudentImportRow>(
    text,
    [
      { label: 'student_id', aliases: idAliases },
      { label: 'first_name', aliases: ['first name', 'first'] },
      { label: 'last_name', aliases: ['last name', 'last'] },
    ],
    (raw, issues) => {
      const firstName = rosterCell(raw, 'first name', 'first') ?? '';
      const lastName = rosterCell(raw, 'last name', 'last') ?? '';
      if (!firstName) issues.push('First name is required.');
      if (!lastName) issues.push('Last name is required.');
      const major = pathway(
        rosterCell(raw, ...majorAliases),
        'Major pathway',
        issues,
      );
      const minor = pathway(
        rosterCell(raw, ...minorAliases),
        'Minor pathway',
        issues,
      );
      if (major && minor && major === minor)
        issues.push('Minor pathway must be different from major pathway.');
      return {
        uniqueId: studentId(raw, issues),
        firstName,
        lastName,
        email: rosterCell(raw, 'email', 'student email'),
        gradeLevel: grade(rosterCell(raw, ...gradeAliases), issues),
        major,
        minor,
      };
    },
  );
}

export function previewStudentBulkUpdateCsv(text: string) {
  return reviewRosterCsv<StudentBulkUpdateRow>(
    text,
    [{ label: 'student_id', aliases: idAliases }],
    (raw, issues) => {
      const row: StudentBulkUpdateRow = { uniqueId: studentId(raw, issues) };
      const included = (aliases: string[]) =>
        aliases.some((alias) => normalizeRosterHeader(alias) in raw);
      if (included(gradeAliases))
        row.gradeLevel =
          grade(rosterCell(raw, ...gradeAliases), issues) ?? null;
      if (included(majorAliases))
        row.major =
          pathway(rosterCell(raw, ...majorAliases), 'Major pathway', issues) ??
          null;
      if (included(minorAliases))
        row.minor =
          pathway(rosterCell(raw, ...minorAliases), 'Minor pathway', issues) ??
          null;
      if (row.major && row.minor && row.major === row.minor)
        issues.push('Minor pathway must be different from major pathway.');
      return row;
    },
    (headers) =>
      [...gradeAliases, ...majorAliases, ...minorAliases].some((alias) =>
        headers.includes(normalizeRosterHeader(alias)),
      )
        ? undefined
        : 'CSV must include grade_level, major_pathway, or minor_pathway.',
  );
}

export const parseStudentImportCsv = (text: string) =>
  validRosterRows(previewStudentImportCsv(text));
export const parseStudentBulkUpdateCsv = (text: string) =>
  validRosterRows(previewStudentBulkUpdateCsv(text));
