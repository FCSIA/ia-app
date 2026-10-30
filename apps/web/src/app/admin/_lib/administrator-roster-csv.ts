import type { FunctionArgs } from 'convex/server';
import { api } from '~/apps/convex/src/_generated/api';
import { reviewRosterCsv, rosterCell, validRosterRows } from './roster-csv';

export type AdministratorImportRow = FunctionArgs<
  typeof api.users.admin.importAdministrators
>['rows'][number];
const idAliases = [
  'administrator id',
  'admin id',
  'employee id',
  'staff id',
  'unique id',
  'id',
];
const emailAliases = [
  'email',
  'administrator email',
  'admin email',
  'staff email',
];

export function previewAdministratorRosterCsv(text: string) {
  return reviewRosterCsv<AdministratorImportRow>(
    text,
    [
      { label: 'administrator_id', aliases: idAliases },
      { label: 'first_name', aliases: ['first name', 'first'] },
      { label: 'last_name', aliases: ['last name', 'last'] },
      { label: 'email', aliases: emailAliases },
    ],
    (raw, issues) => {
      const value = {
        uniqueId: rosterCell(raw, ...idAliases) ?? '',
        firstName: rosterCell(raw, 'first name', 'first') ?? '',
        lastName: rosterCell(raw, 'last name', 'last') ?? '',
        email: rosterCell(raw, ...emailAliases) ?? '',
      };
      if (!value.uniqueId) issues.push('Administrator ID is required.');
      else if (value.uniqueId.length < 3)
        issues.push('Administrator ID must contain at least 3 characters.');
      if (!value.firstName) issues.push('First name is required.');
      if (!value.lastName) issues.push('Last name is required.');
      if (!value.email) issues.push('Email is required.');
      return value;
    },
  );
}
export const parseAdministratorRosterCsv = (text: string) =>
  validRosterRows(previewAdministratorRosterCsv(text));
