import { describe, expect, test } from 'vitest';
import { parseAdministratorRosterCsv } from './administrator-roster-csv';

describe('administrator roster CSV parser', () => {
  test('reads the documented headers and ignores blank lines', () => {
    expect(
      parseAdministratorRosterCsv(
        'first_name,last_name,administrator_id,email\nAda,Lovelace,ADM001,ada@example.com\n\n',
      ),
    ).toEqual([
      {
        firstName: 'Ada',
        lastName: 'Lovelace',
        uniqueId: 'ADM001',
        email: 'ada@example.com',
      },
    ]);
  });

  test('accepts common staff-system headers and quoted values', () => {
    expect(
      parseAdministratorRosterCsv(
        'first,last,employee_id,staff_email\n"Grace", "O""Neil",EMP-42,grace@example.com',
      ),
    ).toEqual([
      {
        firstName: 'Grace',
        lastName: 'O"Neil',
        uniqueId: 'EMP-42',
        email: 'grace@example.com',
      },
    ]);
  });
});

import { previewAdministratorRosterCsv } from './administrator-roster-csv';
import { canSubmitRoster } from './roster-csv';

describe('administrator roster review', () => {
  test('requires every account field before granting administrator access', () => {
    const preview = previewAdministratorRosterCsv(
      'first,last,staff_id,email\nAda,,AD,',
    );
    expect(preview.rows[0]?.issues).toEqual(
      expect.arrayContaining([
        'Last name is required.',
        'Email is required.',
        'Administrator ID must contain at least 3 characters.',
      ]),
    );
    expect(canSubmitRoster(preview)).toBe(false);
    expect(() =>
      parseAdministratorRosterCsv(
        'first,last,staff_id,email\nAda,Lovelace,ADM001,',
      ),
    ).toThrow('Email is required');
  });

  test('does not accept ambiguous duplicate normalized headers', () => {
    const preview = previewAdministratorRosterCsv(
      'first,last,staff_id,staff id,email\nAda,Lovelace,ADM001,ADM002,ada@example.com',
    );
    expect(preview.issues).toContain('Column headers must be unique.');
    expect(canSubmitRoster(preview)).toBe(false);
  });
});
