'use client';

import { useDeferredValue, useState } from 'react';
import { format } from 'date-fns';
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, auditActionLabel, auditRecordLabel, type AuditCategory } from '~/apps/shared/audit';
import { displayName } from '~/apps/shared/user-name';
import { api } from '~/apps/convex/src/_generated/api';
import { useQuery } from '@/lib/convex-react';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search';
import { CheckboxGroup, CheckboxItem } from '@/components/ui/checkbox-group';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { useAdminAudit } from '../../_hooks/use-admin-audit';

type AuditState = ReturnType<typeof useAdminAudit>;
export type AuditFilterColumn = 'When' | 'Person' | 'Action' | 'Record';

function PersonFilter({ audit }: { audit: AuditState }) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const people = useQuery(api.users.admin.list, { paginationOpts: { numItems: 20, cursor: null }, search: deferredSearch || undefined });
  return <FieldGroup>
    <Command shouldFilter={false} surface="inherit">
      <CommandInput value={search} onValueChange={setSearch} placeholder="Find a person…" aria-label="Find a person" />
      <CommandList>
        <CommandEmpty>{people === undefined ? 'Loading people…' : 'No people found'}</CommandEmpty>
        <CommandItem value="any" onSelect={() => audit.setAuditActor('')}>Any person</CommandItem>
        {people?.page.map((person) => <CommandItem key={person._id} value={person._id} onSelect={() => audit.setAuditActorId(person._id, displayName(person))}>
          <span className="truncate">{displayName(person)}</span>
          <span className="ml-auto text-xs text-muted-foreground">{person.uniqueId}</span>
        </CommandItem>)}
      </CommandList>
    </Command>
    <Field><FieldLabel>Source</FieldLabel>
      <Select value={audit.auditActorScope} onValueChange={(value) => audit.setAuditActorScope(value as 'ALL' | 'USER' | 'SYSTEM')}>
        <SelectTrigger aria-label="Activity source" />
        <SelectContent>
          <SelectItem index={0} value="ALL">All sources</SelectItem>
          <SelectItem index={1} value="USER">People</SelectItem>
          <SelectItem index={2} value="SYSTEM">System</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  </FieldGroup>;
}

export function AuditColumnFilter({ column, audit }: { column: AuditFilterColumn; audit: AuditState }) {
  if (column === 'Person') return <PersonFilter audit={audit} />;
  if (column === 'When') return <FieldGroup>
    <Field><FieldLabel>From</FieldLabel><DatePicker placeholder="From date" value={audit.auditStartDate} onChange={audit.setAuditStartDateWithBounds} disabledDays={audit.auditEndDate ? (date) => format(date, 'yyyy-MM-dd') > audit.auditEndDate : undefined} allowClear /></Field>
    <Field><FieldLabel>To</FieldLabel><DatePicker placeholder="To date" value={audit.auditEndDate} onChange={audit.setAuditEndDateWithBounds} disabledDays={audit.auditStartDate ? (date) => format(date, 'yyyy-MM-dd') < audit.auditStartDate : undefined} allowClear /></Field>
  </FieldGroup>;
  if (column === 'Action') return <ActionFilter audit={audit} />;
  return <FieldGroup>
    <Field><FieldLabel>Record type</FieldLabel>
      <Select value={audit.auditEntityTypeFilter} onValueChange={audit.setAuditEntityTypeFilter}>
        <SelectTrigger aria-label="Record type" />
        <SelectContent><SelectItem index={0} value="ALL">All record types</SelectItem>
          {audit.auditEntityTypeOptions.map((type, index) => <SelectItem key={type} index={index + 1} value={type}>{auditRecordLabel(type)}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
    <Field><FieldLabel htmlFor="audit-record-id">Record ID</FieldLabel><Input id="audit-record-id" value={audit.auditEntityId} onChange={(event) => audit.setAuditEntityId(event.target.value)} placeholder="Specific record" /></Field>
  </FieldGroup>;
}

function ActionFilter({ audit }: { audit: AuditState }) {
  const [search, setSearch] = useState('');
  const categories = Object.entries(AUDIT_CATEGORIES) as [AuditCategory, string][];
  const actions = audit.auditActionOptions.filter((action) =>
    (!audit.auditCategoryFilters.length || audit.auditCategoryFilters.includes(AUDIT_ACTIONS[action]?.category))
    && `${auditActionLabel(action)} ${action}`.toLowerCase().includes(search.toLowerCase()));
  return <FieldGroup>
    <Field><FieldLabel>Categories</FieldLabel>
      <CheckboxGroup className="w-full" aria-label="Activity categories" checkedIndices={new Set(categories.flatMap(([category], index) => audit.auditCategoryFilters.includes(category) ? [index] : []))}>
        {categories.map(([category, label], index) => <CheckboxItem key={category} index={index} label={`${label}${audit.auditCounts?.total != null ? ` (${audit.auditCounts.byCategory.find((row) => row.category === category)?.count ?? 0})` : ''}`} checked={audit.auditCategoryFilters.includes(category)} onToggle={() => audit.setAuditCategoryFilters(audit.auditCategoryFilters.includes(category) ? audit.auditCategoryFilters.filter((value) => value !== category) : [...audit.auditCategoryFilters, category])} />)}
      </CheckboxGroup>
    </Field>
    <Field><FieldLabel>Actions</FieldLabel>
      <SearchInput value={search} onValueChange={setSearch} placeholder="Find an action…" aria-label="Find an action" />
      <div className="max-h-48 overflow-y-auto">
        <CheckboxGroup className="w-full" aria-label="Activity actions" checkedIndices={new Set(actions.flatMap((action, index) => audit.auditActionFilters.includes(action) ? [index] : []))}>
          {actions.map((action, index) => <CheckboxItem key={action} index={index} title={auditActionLabel(action)} label={auditActionLabel(action)} checked={audit.auditActionFilters.includes(action)} onToggle={() => audit.setAuditActionFilters(audit.auditActionFilters.includes(action) ? audit.auditActionFilters.filter((value) => value !== action) : [...audit.auditActionFilters, action])} />)}
        </CheckboxGroup>
        {!actions.length ? <p className="py-2 text-sm text-muted-foreground">No actions match.</p> : null}
      </div>
    </Field>
  </FieldGroup>;
}
