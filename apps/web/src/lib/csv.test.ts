import { describe, expect, it } from 'vitest';
import { readCsv, readCsvTable } from './csv';
import { parseInviteCsv } from './parse-invite-csv';

describe('readCsv', () => {
  it('reads quoted commas, escaped quotes, a BOM and CRLF', () => {
    expect(readCsv('﻿name,note\r\n"Doe, Jane","say ""hi"""\r\n')).toEqual([
      { line: 1, cells: ['name', 'note'] },
      { line: 2, cells: ['Doe, Jane', 'say "hi"'] },
    ]);
  });

  it('keeps newlines inside quotes and numbers later records by physical line', () => {
    const records = readCsv('a,b\n"one\ntwo",x\nlast,y');
    expect(records[1].cells[0]).toBe('one\ntwo');
    expect(records[2].line).toBe(4);
  });

  it('rejects malformed quoting with the line number', () => {
    expect(() => readCsv('a,b\nx"y,z')).toThrow('Line 2');
    expect(() => readCsv('a\n"open')).toThrow('missing its closing quote');
  });

  it('normalizes header names', () => {
    expect(readCsvTable('Unit Name,PARENT_unit\nA,B').headers).toEqual(['unitname', 'parentunit']);
  });
});

describe('parseInviteCsv', () => {
  it('honours escaped quotes and picks the identifier column', () => {
    expect(parseInviteCsv('Name,Student ID\n"Doe ""DJ""",S123\n,S456')).toEqual(['S123', 'S456']);
  });
});
