import { describe, expect, test } from 'vitest';
import { parseStudentBulkUpdateCsv } from './student-roster-csv';

describe('student roster bulk-update CSV parser', () => {
  test('updates only the pathway columns supplied by the file', () => {
    expect(
      parseStudentBulkUpdateCsv(
        'student_id,major_pathway\nSTU001,Engineering\nSTU002,IT',
      ),
    ).toEqual([
      { uniqueId: 'STU001', major: 'ENGINEERING' },
      { uniqueId: 'STU002', major: 'INFORMATION_TECHNOLOGY' },
    ]);
  });

  test('uses blanks in included columns to clear optional student fields', () => {
    expect(
      parseStudentBulkUpdateCsv(
        'student_id,minor_pathway,grade_level\nSTU001, ,',
      ),
    ).toEqual([{ uniqueId: 'STU001', minor: null, gradeLevel: null }]);
  });

  test('requires a student ID and at least one supported update column', () => {
    expect(() =>
      parseStudentBulkUpdateCsv('major_pathway\nEngineering'),
    ).toThrow('student_id');
    expect(() => parseStudentBulkUpdateCsv('student_id\nSTU001')).toThrow(
      'grade_level',
    );
  });
});

import {
  parseStudentImportCsv,
  previewStudentImportCsv,
  previewStudentBulkUpdateCsv,
} from './student-roster-csv';
import { canSubmitRoster } from './roster-csv';

describe('student roster review before submission', () => {
  test('collects row errors and rejects partial numeric grades and duplicate IDs', () => {
    const preview = previewStudentImportCsv(
      'first_name,last_name,student_id,grade_level,major_pathway,minor_pathway\nAda,Lovelace,STU001,10junk,IT,IT\nGrace,Hopper,stu001,11,Engineering,',
    );
    expect(preview.rows[0]?.issues).toEqual(
      expect.arrayContaining([
        'Grade level must be a whole number from 9 to 12.',
        'Minor pathway must be different from major pathway.',
      ]),
    );
    expect(preview.rows[1]?.issues.join(' ')).toContain('Duplicate ID');
    expect(canSubmitRoster(preview)).toBe(false);
    expect(() =>
      parseStudentImportCsv('first,last,id,grade\nAda,Lovelace,STU001,10junk'),
    ).toThrow('whole number');
  });

  test('shows the real line after blank rows and preserves escaped quotes and quoted newlines', () => {
    const preview = previewStudentImportCsv(
      'first,last,id\n\n"Ada\nAugusta","O""Neil",STU001',
    );
    expect(preview.rows[0]).toMatchObject({
      line: 3,
      value: { firstName: 'Ada\nAugusta', lastName: 'O"Neil' },
      issues: [],
    });
    expect(canSubmitRoster(preview)).toBe(true);
  });

  test('blocks missing headers, malformed quotes, extra columns, and files over the server limit', () => {
    expect(
      previewStudentImportCsv('name,id\nAda,STU001').issues.join(' '),
    ).toContain('first_name');
    expect(
      previewStudentImportCsv(
        'first,last,id\n"Ada,Lovelace,STU001',
      ).issues.join(' '),
    ).toContain('closing quote');
    expect(
      previewStudentImportCsv(
        'first,last,id\nAda,Lovelace,STU001,extra',
      ).rows[0]?.issues.join(' '),
    ).toContain('Expected 3 columns');
    const oversized = previewStudentImportCsv(
      `first,last,id\n${Array.from({ length: 201 }, (_, index) => `Ada,Lovelace,STU${index}`).join('\n')}`,
    );
    expect(oversized.issues.join(' ')).toContain('200');
    expect(canSubmitRoster(oversized)).toBe(false);
  });

  test('revalidates update data while preserving blank-clear and absent-column semantics', () => {
    const preview = previewStudentBulkUpdateCsv(
      'student_id,minor_pathway,grade_level\nSTU001,,',
    );
    expect(canSubmitRoster(preview)).toBe(true);
    expect(preview.rows[0]?.value).toEqual({
      uniqueId: 'STU001',
      minor: null,
      gradeLevel: null,
    });
    expect(
      previewStudentBulkUpdateCsv(
        'student_id,grade_level\nSTU001,10junk',
      ).rows[0]?.issues.join(' '),
    ).toContain('whole number');
  });
});
