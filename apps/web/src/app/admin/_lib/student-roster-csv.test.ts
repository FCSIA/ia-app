import { describe, expect, test } from 'vitest';
import { parseStudentBulkUpdateCsv } from './student-roster-csv';

describe('student roster bulk-update CSV parser', () => {
  test('updates only the pathway columns supplied by the file', () => {
    expect(
      parseStudentBulkUpdateCsv('student_id,major_pathway\nSTU001,Engineering\nSTU002,IT'),
    ).toEqual([
      { uniqueId: 'STU001', major: 'ENGINEERING' },
      { uniqueId: 'STU002', major: 'INFORMATION_TECHNOLOGY' },
    ]);
  });

  test('uses blanks in included columns to clear optional student fields', () => {
    expect(
      parseStudentBulkUpdateCsv('student_id,minor_pathway,grade_level\nSTU001, ,'),
    ).toEqual([{ uniqueId: 'STU001', minor: null, gradeLevel: null }]);
  });

  test('requires a student ID and at least one supported update column', () => {
    expect(() => parseStudentBulkUpdateCsv('major_pathway\nEngineering')).toThrow('student_id');
    expect(() => parseStudentBulkUpdateCsv('student_id\nSTU001')).toThrow('grade_level');
  });
});
