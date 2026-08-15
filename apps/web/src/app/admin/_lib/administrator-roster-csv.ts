import type { FunctionArgs } from 'convex/server';
import { api } from '~/apps/convex/src/_generated/api';

type AdministratorImportRow = FunctionArgs<typeof api.users.admin.importAdministrators>['rows'][number];

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

export function parseAdministratorRosterCsv(text: string): AdministratorImportRow[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]!).map(normalizeHeader);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
    return {
      uniqueId: pick(row, 'administrator id', 'administrator_id', 'admin id', 'admin_id', 'employee id', 'employee_id', 'staff id', 'staff_id', 'unique id', 'unique_id', 'id') ?? '',
      firstName: pick(row, 'first name', 'first_name', 'firstName', 'first') ?? '',
      lastName: pick(row, 'last name', 'last_name', 'lastName', 'last') ?? '',
      email: pick(row, 'email', 'administrator email', 'admin email', 'staff email') ?? '',
    };
  });
}
