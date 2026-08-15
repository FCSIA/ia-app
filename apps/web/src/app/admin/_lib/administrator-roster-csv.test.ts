import { describe, expect, test } from 'vitest';
import { parseAdministratorRosterCsv } from './administrator-roster-csv';

describe('administrator roster CSV parser', () => {
  test('reads the documented headers and ignores blank lines', () => {
    expect(
      parseAdministratorRosterCsv('first_name,last_name,administrator_id,email\nAda,Lovelace,ADM001,ada@example.com\n\n'),
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
      parseAdministratorRosterCsv('first,last,employee_id,staff_email\n"Grace", "O""Neil",EMP-42,grace@example.com'),
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
