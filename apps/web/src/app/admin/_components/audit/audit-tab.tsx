'use client';

import { useEffect, useState } from 'react';
import { CircleHelp, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchToolbarRow } from '@/components/ui/search';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { useAdminAudit } from '../../_hooks/use-admin-audit';
import { AuditDetailSheet } from './audit-detail-sheet';
import { AuditColumnFilter, type AuditFilterColumn } from './audit-filters';
import { AuditTable } from './audit-table';
import { AuditSearch } from './audit-search';

const columns: AuditFilterColumn[] = ['When', 'Person', 'Action', 'Record'];

/** Shown rows against the exact total when one is known; otherwise a lower bound until history is exhausted. */
function auditCountLabel(audit: ReturnType<typeof useAdminAudit>) {
  if (audit.isAuditLoading) return '—';
  const shown = audit.auditEvents.length;
  const total = audit.auditCounts?.exact ? audit.auditCounts.total : null;
  const unit = (n: number) => audit.hasActiveAuditFilters ? (n === 1 ? 'match' : 'matches') : (n === 1 ? 'event' : 'events');
  if (total != null) return shown >= total ? `${total.toLocaleString()} ${unit(total)}` : `${shown.toLocaleString()} / ${total.toLocaleString()} ${unit(total)}`;
  return audit.auditStatus === 'Exhausted' ? `${shown.toLocaleString()} ${unit(shown)}` : `${shown.toLocaleString()}+ ${unit(shown)}`;
}

export function AuditTab() {
  const audit = useAdminAudit('audit');
  const total = audit.auditCounts?.total;
  const liveCount = auditCountLabel(audit);
  // A refresh keeps the previous rows on screen, so it keeps their count too.
  const [settledCount, setSettledCount] = useState(liveCount);
  useEffect(() => { if (!audit.isStale) setSettledCount(liveCount); }, [audit.isStale, liveCount]);
  const count = audit.isStale ? settledCount : liveCount;
  return <>
    <section aria-label="Audit activity" className="flex min-w-0 flex-col gap-3">
      <SearchToolbarRow className="flex-row items-center gap-2">
        <AuditSearch audit={audit} />
        <Popover><PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label="Search syntax help"><CircleHelp /></Button></PopoverTrigger>
          <PopoverContent align="end" className="w-80 text-sm">
            <p className="font-medium">Search activity</p>
            <p className="mt-2 text-muted-foreground">Combine person:, action:, type:, record:, text:, source:person or source:system. Quote phrases and use - to exclude a term.</p>
            <p className="mt-2 text-muted-foreground">after:2026-10-01 before:2026-10-02 includes both dates in UTC. Column date filters use your local time.</p>
          </PopoverContent>
        </Popover>
        <div className="md:hidden"><Drawer><DrawerTrigger asChild><Button type="button" variant="tertiary" size="icon" aria-label={`Filters${audit.auditFilterChips.length ? ` (${audit.auditFilterChips.length})` : ''}`}><SlidersHorizontal /></Button></DrawerTrigger>
          <DrawerContent><DrawerHeader><DrawerTitle>Filter activity</DrawerTitle><DrawerDescription>Changes apply as you select filters.</DrawerDescription></DrawerHeader>
            <div className="min-h-0 space-y-6 overflow-y-auto px-4 pb-4">{columns.map((column) => <section key={column} className="space-y-3"><h3 className="font-semibold">{column}</h3><AuditColumnFilter column={column} audit={audit} /></section>)}</div>
            <DrawerFooter><DrawerClose asChild><Button type="button">Show {audit.auditCounts?.exact && total != null ? `${total} ` : ''}events</Button></DrawerClose><Button type="button" variant="ghost" onClick={audit.clearAuditFilters}>Clear filters</Button></DrawerFooter>
          </DrawerContent>
        </Drawer></div>
        <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground lg:block" role="status" aria-live="polite">{count}</span>
      </SearchToolbarRow>
      {audit.advancedError ? <p id="audit-query-error" role="status" className="text-xs text-destructive">{audit.advancedError} Showing the last valid search.</p> : null}
      {audit.auditFilterChips.length ? <div className="flex flex-wrap items-center gap-1" aria-label="Active filters">{audit.auditFilterChips.map((chip) => <Button key={chip.label} type="button" size="sm" variant="secondary" trailingIcon={X} onClick={chip.clear} aria-label={`Remove ${chip.label}`}>{chip.label}</Button>)}<Button type="button" size="sm" variant="ghost" onClick={audit.clearAuditFilters}>Clear all</Button></div> : null}
      <p className="text-xs tabular-nums text-muted-foreground lg:hidden" role="status">{count}</p>
      <AuditTable audit={audit} />
    </section>
    <AuditDetailSheet selectedEventId={audit.selectedAuditEventId} onSelectedEventIdChange={audit.setSelectedAuditEventId} eventDetail={audit.auditEventDetail} isDetailLoading={audit.isAuditDetailLoading} onFilterPerson={(id, name) => { audit.setSelectedAuditEventId(null); audit.setAuditActorId(id, name); }} />
  </>;
}
