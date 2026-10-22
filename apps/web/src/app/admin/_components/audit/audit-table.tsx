'use client';

import Link from 'next/link';
import { Fragment } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { CalendarDays, ChevronRight, FileText, Megaphone, MessagesSquare, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardGroup, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PersonTrigger } from '@/components/users/person-trigger';
import { useIsMobile } from '@/hooks/use-mobile';
import { Table, TableBody, TableCell, TableGroupRow, TableHead, TableHeadFilter, TableHeader, TableRow } from '@/components/ui/table';
import { AdminNotice } from '../admin-ui';
import { AUDIT_FETCH_LIMIT } from '../../_lib/admin-utils';
import type { AuditEventRecord } from '../../_lib/types';
import type { useAdminAudit } from '../../_hooks/use-admin-audit';
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, auditActionLabel, auditCategory, auditPersonName, auditRecordTitle } from '~/apps/shared/audit';
import { AuditColumnFilter, type AuditFilterColumn } from './audit-filters';

type AuditState = ReturnType<typeof useAdminAudit>;
const icons = { 'people-access': Users, 'clubs-chat': MessagesSquare, announcements: Megaphone, moderation: Shield, schedules: FileText, 'flex-events': CalendarDays };
function DayLabel({ date }: { date: Date }) { return <>{isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : format(date, 'EEEE, MMM d, yyyy')}</>; }
function Person({ event, audit }: { event: AuditEventRecord; audit: AuditState }) {
  return event.actor ? <PersonTrigger person={{ ...event.actor, _id: event.actor.id, preferredName: event.actor.preferredName ?? undefined }} usersHref={`/admin/users?user=${encodeURIComponent(event.actor.id)}`} actions={<Button type="button" size="sm" variant="ghost" onClick={() => audit.setAuditActorId(event.actor!.id, auditPersonName(event))}>Filter by this person</Button>} /> : <span className="truncate text-muted-foreground">{auditPersonName(event)}</span>;
}
function Action({ event }: { event: AuditEventRecord }) {
  const category = auditCategory(event.entityType, event.action);
  const Icon = icons[category];
  return <span className="flex min-w-0 items-center gap-2"><Icon size={14} className="shrink-0 text-muted-foreground" aria-label={AUDIT_CATEGORIES[category]} /><span className={`truncate ${AUDIT_ACTIONS[event.action]?.destructive ? 'text-destructive' : 'text-foreground'}`}>{auditActionLabel(event.action)}</span></span>;
}
export function AuditTable({ audit }: { audit: AuditState }) {
  const isMobile = useIsMobile();
  const events = audit.displayedAuditEvents;
  const filtersActive = (column: AuditFilterColumn) => column === 'When' ? !!(audit.auditStartDate || audit.auditEndDate) : column === 'Person' ? !!(audit.auditActorId || audit.auditActor || audit.auditActorScope !== 'ALL') : column === 'Action' ? !!(audit.auditCategoryFilters.length || audit.auditActionFilters.length) : !!(audit.auditEntityId || audit.auditEntityTypeFilter !== 'ALL');
  const empty = <AdminNotice message="No activity matches these filters." actionLabel={audit.hasActiveAuditFilters ? 'Clear filters' : undefined} onAction={audit.hasActiveAuditFilters ? audit.clearAuditFilters : undefined} />;
  return <div className="min-w-0 space-y-3" aria-busy={audit.isStale || audit.auditStatus === 'LoadingMore'}>
    {!isMobile ? <div className="hidden md:block"><Table className="table-fixed" aria-label="Audit activity">
      <colgroup><col className="w-[112px]" /><col className="w-[19%]" /><col className="w-[20%]" /><col /><col className="hidden w-[19%] xl:table-column" /><col className="w-11" /></colgroup>
      <TableHeader><TableRow>{(['When', 'Person', 'Action', 'Record'] as const).map((column) => <TableHead key={column} scope="col"><TableHeadFilter label={column} active={filtersActive(column)}><AuditColumnFilter column={column} audit={audit} /></TableHeadFilter></TableHead>)}<TableHead scope="col" className="hidden xl:table-cell">Where</TableHead><TableHead scope="col"><span className="sr-only">Details</span></TableHead></TableRow></TableHeader>
      <TableBody>
        {audit.isAuditLoading ? Array.from({ length: 8 }, (_, index) => <TableRow key={index}><TableCell colSpan={6}><Skeleton className="h-5 w-full" /></TableCell></TableRow>) : events.length ? events.map((event, index) => {
          const date = new Date(event.createdAt);
          const newDay = index === 0 || format(date, 'yyyy-MM-dd') !== format(new Date(events[index - 1]!.createdAt), 'yyyy-MM-dd');
          const primary = event.context?.links?.find((link) => link.id === event.entityId);
          const where = event.context?.links?.find((link) => link.id !== event.entityId && link.href && !/person|user|actor/i.test(link.label));
          const title = auditRecordTitle(event);
          return <Fragment key={event.id}>
            {newDay ? <TableGroupRow colSpan={6}><DayLabel date={date} /></TableGroupRow> : null}
            <TableRow index={index} interactive selected={audit.selectedAuditEventId === event.id} onClick={(click) => {
              const target = click.target;
              if (!(target instanceof Element) || !click.currentTarget.contains(target) || target.closest('button,a,input,[role="button"]')) return;
              audit.setSelectedAuditEventId(event.id);
            }}>
              <TableCell><time className="tabular-nums" dateTime={event.createdAt} title={format(date, 'PPpp')}>{format(date, 'h:mm a')}</time></TableCell>
              <TableCell><Person event={event} audit={audit} /></TableCell>
              <TableCell><Action event={event} /></TableCell>
              <TableCell>{primary?.href ? <Link className="block truncate text-foreground hover:underline focus-visible:underline" href={primary.href} title={title}>{title}</Link> : <span className="block truncate text-foreground" title={title}>{title}</span>}</TableCell>
              <TableCell className="hidden xl:table-cell">{where?.href ? <Link href={where.href} className="block truncate hover:underline" title={where.name}>{where.name}</Link> : <span className="block truncate">{event.context?.subtitle || '—'}</span>}</TableCell>
              <TableCell><Button type="button" variant="ghost" size="icon-compact" aria-label={`Details: ${auditActionLabel(event.action)} by ${auditPersonName(event)}`} onClick={() => audit.setSelectedAuditEventId(event.id)}><ChevronRight /></Button></TableCell>
            </TableRow>
          </Fragment>;
        }) : <TableRow><TableCell colSpan={6}>{empty}</TableCell></TableRow>}
      </TableBody>
    </Table></div> : null}
    <div className="md:hidden">{audit.isAuditLoading ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div> : events.length ? <CardGroup orientation="inline" border="none" corners="compact">{events.map((event) => <Card key={event.id} onClick={() => audit.setSelectedAuditEventId(event.id)} selected={event.id === audit.selectedAuditEventId} label={`Details: ${auditActionLabel(event.action)} by ${auditPersonName(event)}`}><CardHeader><CardTitle><span className="flex min-w-0 items-center justify-between gap-2"><Action event={event} /><time className="shrink-0 text-xs tabular-nums text-muted-foreground" dateTime={event.createdAt} title={format(new Date(event.createdAt), 'PPpp')}>{format(new Date(event.createdAt), 'h:mm a')}</time></span></CardTitle><CardDescription className="truncate">{auditPersonName(event)} · {auditRecordTitle(event)}</CardDescription></CardHeader></Card>)}</CardGroup> : empty}</div>
    {audit.auditStatus !== 'Exhausted' && !audit.isAuditLoading ? <div className="flex justify-center"><Button type="button" variant="tertiary" loading={audit.auditStatus === 'LoadingMore' || audit.isStale} disabled={audit.auditStatus !== 'CanLoadMore' || audit.isStale} onClick={() => audit.loadMoreAuditEvents(AUDIT_FETCH_LIMIT)}>Load older activity</Button></div> : null}
  </div>;
}
