'use client';

import { useDeferredValue, useState } from 'react';
import { format, subDays } from 'date-fns';
import { api } from '~/apps/convex/src/_generated/api';
import { auditActionLabel, auditRecordLabel } from '~/apps/shared/audit';
import { displayName } from '~/apps/shared/user-name';
import { useQuery } from '@/lib/convex-react';
import { Command, CommandInputSlot, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { SearchInput } from '@/components/ui/search';
import type { useAdminAudit } from '../../_hooks/use-admin-audit';

type Suggestion = { value: string; label: string };
export function AuditSearch({ audit }: { audit: ReturnType<typeof useAdminAudit> }) {
  const [active, setActive] = useState(false);
  const match = audit.auditSearch.match(/(?:^|\s)(-?)(person|action|type|record|source|after|before):(?:"([^"\n]*)|([^\s"]*))$/i);
  const field = match?.[2]?.toLowerCase();
  const fragment = (match?.[3] ?? match?.[4] ?? '').toLowerCase();
  const search = useDeferredValue(fragment);
  const people = useQuery(api.users.admin.list, active && field === 'person' ? { search: search || undefined, paginationOpts: { numItems: 10, cursor: null } } : 'skip');
  let suggestions: Suggestion[] = [];
  if (field === 'person') suggestions = (people?.page ?? []).map((person) => ({ value: displayName(person), label: `${displayName(person)} · ${person.uniqueId}` }));
  if (field === 'action') suggestions = audit.auditActionOptions.map((value) => ({ value, label: auditActionLabel(value) }));
  if (field === 'type') suggestions = audit.auditEntityTypeOptions.map((value) => ({ value, label: auditRecordLabel(value) }));
  if (field === 'record') suggestions = [...new Map(audit.auditEvents.filter((event) => event.entityId).map((event) => [event.entityId!, { value: event.entityId!, label: event.context.title }])).values()];
  if (field === 'source') suggestions = [{ value: 'person', label: 'People' }, { value: 'system', label: 'System' }];
  if (field === 'after' || field === 'before') suggestions = [{ value: format(new Date(), 'yyyy-MM-dd'), label: 'Today' }, { value: format(subDays(new Date(), 7), 'yyyy-MM-dd'), label: 'A week ago' }];
  if (field !== 'person') suggestions = suggestions.filter((item) => `${item.value} ${item.label}`.toLowerCase().includes(fragment));
  suggestions = suggestions.slice(0, 10);
  const open = active && !!match && suggestions.length > 0;
  return <Popover open={open} onOpenChange={setActive}>
    <Command surface="inherit" shouldFilter={false} loop className="h-auto min-w-0 flex-1 overflow-visible">
      <PopoverAnchor asChild>
        <div className="min-w-0">
          <CommandInputSlot asChild value={audit.auditSearch} onValueChange={(value) => { setActive(true); audit.setAuditSearch(value); }}>
            <SearchInput aria-label="Search audit activity" aria-expanded={open} aria-invalid={!!audit.advancedError} aria-describedby={audit.advancedError ? 'audit-query-error' : undefined} value={audit.auditSearch} onValueChange={audit.setAuditSearch} onFocus={() => setActive(true)} placeholder={'Search… or person:"Alex" action:deleted'} />
          </CommandInputSlot>
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-[min(32rem,calc(100vw-2rem))] p-0" onOpenAutoFocus={(event) => event.preventDefault()} onCloseAutoFocus={(event) => event.preventDefault()}>
        <CommandList aria-label={`${field} suggestions`}>
          {suggestions.map((suggestion) => <CommandItem key={suggestion.value} value={suggestion.value} onSelect={() => {
            if (!match) return;
            const start = match.index! + (match[0].startsWith(' ') ? 1 : 0);
            audit.setAuditSearch(`${audit.auditSearch.slice(0, start)}${match[1]}${field}:${JSON.stringify(suggestion.value)} `);
            setActive(false);
          }}>{suggestion.label}</CommandItem>)}
        </CommandList>
      </PopoverContent>
    </Command>
  </Popover>;
}
