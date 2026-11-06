'use client';

import { useDeferredValue, useRef, useState, type ReactNode } from 'react';
import { format, subDays } from 'date-fns';
import { AUDIT_CATEGORIES, auditActionInfo, auditActionLabel, auditRecordLabel, type AuditCategory } from '~/apps/shared/audit';
import { displayName } from '~/apps/shared/user-name';
import { api } from '~/apps/convex/src/_generated/api';
import { useQuery } from '@/lib/convex-react';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { DateField } from '@/components/forms/date-field';
import { Dropdown, DropdownContent, DropdownEmpty, DropdownLabel, DropdownSearch, DropdownSeparator } from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import type { useAdminAudit } from '../../_hooks/use-admin-audit';

type AuditState = ReturnType<typeof useAdminAudit>;
export type AuditFilterColumn = 'When' | 'Person' | 'Action' | 'Record';
/** `menu` is a header popup; `panel` is the same rows inline in the phone drawer. */
export type AuditFilterSurface = 'menu' | 'panel';

const matches = (text: string, query: string) => text.toLowerCase().includes(query.trim().toLowerCase());

/** One set of rows, rendered as the header's popup menu or as an inline panel. */
function FilterSurface({ surface, label, checkedIndex, checkedIndices, onCloseAutoFocus, children }: {
  surface: AuditFilterSurface;
  label: string;
  checkedIndex?: number;
  checkedIndices?: number[];
  onCloseAutoFocus?: (event: Event) => void;
  children: ReactNode;
}) {
  return surface === 'menu'
    ? <DropdownContent align="start" checkedIndex={checkedIndex} checkedIndices={checkedIndices} onCloseAutoFocus={onCloseAutoFocus}>{children}</DropdownContent>
    : <Dropdown aria-label={label} checkedIndex={checkedIndex} checkedIndices={checkedIndices} className="w-full max-w-none">{children}</Dropdown>;
}

type Row = { key: string; label: string; checked: boolean; onSelect: () => void; heading?: string };

/** Indices are flat across headings so the menu's hover and selection stay one list. */
function Rows({ rows }: { rows: Row[] }) {
  return rows.map((row, index) => <MenuItemWithHeading key={row.key} row={row} index={index} first={index === 0} />);
}
function MenuItemWithHeading({ row, index, first }: { row: Row; index: number; first: boolean }) {
  return <>
    {row.heading ? <>{first ? null : <DropdownSeparator />}<DropdownLabel>{row.heading}</DropdownLabel></> : null}
    <MenuItem index={index} label={row.label} checked={row.checked} onSelect={row.onSelect} />
  </>;
}

function PersonFilter({ audit, surface }: { audit: AuditState; surface: AuditFilterSurface }) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const people = useQuery(api.users.admin.list, { paginationOpts: { numItems: 20, cursor: null }, search: deferredSearch || undefined });
  const noPerson = !audit.auditActorId && !audit.auditActor;
  const scopes: Row[] = search.trim() ? [] : [
    { key: 'ALL', label: 'Anyone', checked: noPerson && audit.auditActorScope === 'ALL', onSelect: () => audit.setAuditActorSource('ALL') },
    { key: 'USER', label: 'People only', checked: noPerson && audit.auditActorScope === 'USER', onSelect: () => audit.setAuditActorSource('USER') },
    { key: 'SYSTEM', label: 'System', checked: noPerson && audit.auditActorScope === 'SYSTEM', onSelect: () => audit.setAuditActorSource('SYSTEM') },
  ];
  const personRows: Row[] = (people?.page ?? []).map((person, index) => ({
    key: person._id,
    label: displayName(person),
    heading: index === 0 && scopes.length ? 'People' : undefined,
    checked: audit.auditActorId === person._id,
    onSelect: () => audit.setAuditActorId(person._id, displayName(person)),
  }));
  const rows = [...scopes, ...personRows];
  const checkedIndex = rows.findIndex((row) => row.checked);
  return <FilterSurface surface={surface} label="Person filters" checkedIndex={checkedIndex < 0 ? undefined : checkedIndex}>
    <DropdownSearch value={search} onValueChange={setSearch} placeholder="Find a person…" aria-label="Find a person" autoFocus={surface === 'menu'} />
    <Rows rows={rows} />
    {!rows.length ? <DropdownEmpty>{people === undefined ? 'Loading people…' : 'No people found'}</DropdownEmpty> : null}
  </FilterSurface>;
}

function ActionFilter({ audit, surface }: { audit: AuditState; surface: AuditFilterSurface }) {
  const [search, setSearch] = useState('');
  const toggle = <T extends string>(values: T[], value: T) => values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  const categories = (Object.entries(AUDIT_CATEGORIES) as [AuditCategory, string][]).filter(([, label]) => matches(label, search));
  const actions = audit.auditActionOptions.filter((action) =>
    (!audit.auditCategoryFilters.length || audit.auditCategoryFilters.some((category) => category === auditActionInfo(action)?.category))
    && matches(`${auditActionLabel(action)} ${action}`, search));
  const rows: Row[] = [
    ...categories.map(([category, label], index) => ({
      key: `category:${category}`, label, heading: index === 0 ? 'Categories' : undefined,
      checked: audit.auditCategoryFilters.includes(category),
      onSelect: () => audit.setAuditCategoryFilters(toggle(audit.auditCategoryFilters, category)),
    })),
    ...actions.map((action, index) => ({
      key: `action:${action}`, label: auditActionLabel(action), heading: index === 0 ? 'Actions' : undefined,
      checked: audit.auditActionFilters.includes(action),
      onSelect: () => audit.setAuditActionFilters(toggle(audit.auditActionFilters, action)),
    })),
  ];
  return <FilterSurface surface={surface} label="Action filters" checkedIndices={rows.flatMap((row, index) => row.checked ? [index] : [])}>
    <DropdownSearch value={search} onValueChange={setSearch} placeholder="Find an action…" aria-label="Find an action" autoFocus={surface === 'menu'} />
    <Rows rows={rows} />
    {!rows.length ? <DropdownEmpty>No actions match</DropdownEmpty> : null}
  </FilterSurface>;
}

function RecordFilter({ audit, surface }: { audit: AuditState; surface: AuditFilterSurface }) {
  const [search, setSearch] = useState('');
  const rows: Row[] = [
    ...(search.trim() ? [] : [{ key: 'ALL', label: 'All records', checked: audit.auditEntityTypeFilter === 'ALL', onSelect: () => audit.setAuditEntityTypeFilter('ALL') }]),
    ...audit.auditEntityTypeOptions.filter((type) => matches(auditRecordLabel(type), search)).map((type) => ({
      key: type, label: auditRecordLabel(type), checked: audit.auditEntityTypeFilter === type, onSelect: () => audit.setAuditEntityTypeFilter(type),
    })),
  ];
  const checkedIndex = rows.findIndex((row) => row.checked);
  return <FilterSurface surface={surface} label="Record filters" checkedIndex={checkedIndex < 0 ? undefined : checkedIndex}>
    {audit.auditEntityTypeOptions.length > 8 ? <DropdownSearch value={search} onValueChange={setSearch} placeholder="Find a record type…" aria-label="Find a record type" autoFocus={surface === 'menu'} /> : null}
    <Rows rows={rows} />
    {!rows.length ? <DropdownEmpty>No record types match</DropdownEmpty> : null}
  </FilterSurface>;
}

const day = (offset: number) => format(subDays(new Date(), offset), 'yyyy-MM-dd');
export const WHEN_PRESETS = [
  { label: 'Any time', range: () => ['', ''] },
  { label: 'Today', range: () => [day(0), day(0)] },
  { label: 'Yesterday', range: () => [day(1), day(1)] },
  { label: 'Last 7 days', range: () => [day(6), ''] },
  { label: 'Last 30 days', range: () => [day(29), ''] },
] as const;

/** Presets cover the common questions; a custom range opens the date fields. */
function WhenFilter({ audit, surface, onCustomRange }: { audit: AuditState; surface: AuditFilterSurface; onCustomRange?: () => void }) {
  const preset = WHEN_PRESETS.findIndex((item) => { const [from, to] = item.range(); return from === audit.auditStartDate && to === audit.auditEndDate; });
  const custom = preset < 0;
  // Choosing a custom range hands focus to the range popover, not back to the trigger.
  const handingOff = useRef(false);
    return <>
    <FilterSurface surface={surface} label="Date filters" checkedIndex={custom ? (surface === 'menu' ? WHEN_PRESETS.length : undefined) : preset} onCloseAutoFocus={(event) => { if (handingOff.current) event.preventDefault(); handingOff.current = false; }}>
      {WHEN_PRESETS.map((item, index) => <MenuItem key={item.label} index={index} label={item.label} checked={index === preset} onSelect={() => { const [from, to] = item.range(); audit.setAuditDateRange(from, to); }} />)}
      {surface === 'menu' ? <MenuItem index={WHEN_PRESETS.length} label="Custom range…" checked={custom} onSelect={() => { handingOff.current = true; onCustomRange?.(); }} /> : null}
    </FilterSurface>
    {surface === 'panel' ? <div className="pt-3"><WhenRangeFields audit={audit} /></div> : null}
  </>;
}

export function WhenRangeFields({ audit }: { audit: AuditState }) {
  return <FieldGroup className="grid grid-cols-2 gap-3">
    <Field><FieldLabel>From</FieldLabel><DateField placeholder="From date" value={audit.auditStartDate} onChange={audit.setAuditStartDateWithBounds} disabledDays={audit.auditEndDate ? (date) => format(date, 'yyyy-MM-dd') > audit.auditEndDate : undefined} allowClear /></Field>
    <Field><FieldLabel>To</FieldLabel><DateField placeholder="To date" value={audit.auditEndDate} onChange={audit.setAuditEndDateWithBounds} disabledDays={audit.auditStartDate ? (date) => format(date, 'yyyy-MM-dd') < audit.auditStartDate : undefined} allowClear /></Field>
  </FieldGroup>;
}

export function AuditColumnFilter({ column, audit, surface, onCustomRange }: { column: AuditFilterColumn; audit: AuditState; surface: AuditFilterSurface; onCustomRange?: () => void }) {
  if (column === 'Person') return <PersonFilter audit={audit} surface={surface} />;
  if (column === 'When') return <WhenFilter audit={audit} surface={surface} onCustomRange={onCustomRange} />;
  if (column === 'Action') return <ActionFilter audit={audit} surface={surface} />;
  return <RecordFilter audit={audit} surface={surface} />;
}

export function auditFilterActive(audit: AuditState, column: AuditFilterColumn) {
  if (column === 'When') return !!(audit.auditStartDate || audit.auditEndDate);
  if (column === 'Person') return !!(audit.auditActorId || audit.auditActor || audit.auditActorScope !== 'ALL');
  if (column === 'Action') return !!(audit.auditCategoryFilters.length || audit.auditActionFilters.length);
  return !!(audit.auditEntityId || audit.auditEntityTypeFilter !== 'ALL');
}
