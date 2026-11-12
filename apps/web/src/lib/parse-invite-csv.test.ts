import { describe, expect, it } from 'vitest';
import { parseInviteCsv } from './parse-invite-csv';

describe('parseInviteCsv', () => {
  it('honours escaped quotes and picks the identifier column', () => {
    expect(parseInviteCsv('Name,Student ID\n"Doe ""DJ""",S123\n,S456')).toEqual(['S123', 'S456']);
  });
});
