import { describe, expect, test } from 'vitest';
import { escapeCsvCell } from './admin-utils';

describe('admin CSV export', () => {
  test.each(['=1+1', '+cmd', '-2+3', '@SUM(A1)', '  =HYPERLINK("x")'])(
    'neutralizes spreadsheet formula input %s',
    (value) => expect(escapeCsvCell(value)).toContain("'"),
  );

  test('still escapes quotes and delimiters', () => {
    expect(escapeCsvCell('Ada, "Countess"')).toBe('"Ada, ""Countess"""');
  });
});
