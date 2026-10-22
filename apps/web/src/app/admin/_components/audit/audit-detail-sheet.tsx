'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { PersonTrigger } from '@/components/users/person-trigger';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { AdminNotice } from '../admin-ui';
import type { AuditEventDetail } from '../../_lib/types';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import {
  auditActionLabel,
  auditMetaFields,
  auditPersonName,
  auditRecordTitle,
} from '~/apps/shared/audit';
import { WhiteboardAuditSnapshot } from './whiteboard-audit-snapshot';

function whiteboardSnapshotTarget(event: AuditEventDetail) {
  if (
    event.entityType !== 'ClubWhiteboard' ||
    !['CLUB_WHITEBOARD_EDITED', 'CLUB_WHITEBOARD_RESTORED'].includes(
      event.action,
    )
  )
    return null;
  const meta = event.meta as { boardId?: unknown; toSeq?: unknown } | null;
  if (typeof meta?.boardId !== 'string' || typeof meta.toSeq !== 'number')
    return null;
  return { boardId: meta.boardId as Id<'clubWhiteboards'>, atSeq: meta.toSeq };
}
function displayValue(value: unknown, event: AuditEventDetail): string {
  if (typeof value === 'string')
    return (
      event.context?.references.find((ref) => ref.id === value)?.name ?? value
    );
  if (value === null) return 'None';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return typeof value === 'object'
    ? JSON.stringify(value, null, 2)
    : String(value);
}
type Props = {
  selectedEventId: string | null;
  onSelectedEventIdChange: (id: string | null) => void;
  eventDetail?: AuditEventDetail;
  isDetailLoading: boolean;
  onFilterPerson: (id: string, name: string) => void;
};
export function AuditDetailSheet({
  selectedEventId,
  onSelectedEventIdChange,
  eventDetail,
  isDetailLoading,
  onFilterPerson,
}: Props) {
  const snapshot = eventDetail ? whiteboardSnapshotTarget(eventDetail) : null;
  const recordedFields = eventDetail ? auditMetaFields(eventDetail) : [];
  const openerRef = useRef<HTMLElement | null>(null);
  return (
    <Sheet
      open={!!selectedEventId}
      onOpenChange={(open) => !open && onSelectedEventIdChange(null)}
    >
      <SheetContent
        className="flex h-full w-full flex-col sm:max-w-xl"
        onOpenAutoFocus={() => {
          openerRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        }}
        onCloseAutoFocus={(event) => {
          if (openerRef.current?.isConnected) {
            event.preventDefault();
            openerRef.current.focus();
          }
        }}
      >
        <SheetHeader className="shrink-0">
          <SheetTitle>{eventDetail ? auditActionLabel(eventDetail.action) : 'Activity details'}</SheetTitle>
          <SheetDescription className="sr-only">
            Recorded activity, related records, and original data.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="mt-4 min-h-0 flex-1">
          <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
            {isDetailLoading ? (
              <AdminNotice message="Loading activity details…" />
            ) : eventDetail ? (
              <>
                <p className="text-lg font-medium">{auditRecordTitle(eventDetail)}</p>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      When (your local time)
                    </dt>
                    <dd className="mt-1">
                      {format(new Date(eventDetail.createdAt), 'PPP pp')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Person</dt>
                    <dd className="mt-1">{eventDetail.actor ? <PersonTrigger person={{ ...eventDetail.actor, _id: eventDetail.actor.id, preferredName: eventDetail.actor.preferredName ?? undefined }} usersHref={`/admin/users?user=${encodeURIComponent(eventDetail.actor.id)}`} actions={<Button type="button" variant="ghost" size="sm" onClick={() => onFilterPerson(eventDetail.actor!.id, auditPersonName(eventDetail))}>Filter by this person</Button>} /> : auditPersonName(eventDetail)}</dd>
                  </div>
                </dl>
                {eventDetail.context?.links?.length ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Related records
                    </p>
                    <dl className="grid gap-3 sm:grid-cols-2">
                      {eventDetail.context.links.map((ref) => (
                        <div key={`${ref.label}:${ref.id}`}>
                          <dt className="text-xs text-muted-foreground">
                            {ref.label}
                          </dt>
                          <dd>{ref.href ? <Link href={ref.href} className="text-foreground underline underline-offset-4">{ref.name}</Link> : <>{ref.name}<span className="block text-xs text-muted-foreground">Record unavailable</span></>}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}
                {eventDetail.entityPreview ? (
                  <section className="space-y-3">
                    <h3 className="font-semibold">
                      {eventDetail.entityPreview.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {eventDetail.entityPreview.subtitle}
                    </p>
                    {eventDetail.entityPreview.href && !eventDetail.context?.links?.length ? (
                      <Button asChild variant="tertiary">
                        <Link href={eventDetail.entityPreview.href}>
                          {eventDetail.entityPreview.hrefLabel || 'Open record'}
                        </Link>
                      </Button>
                    ) : null}
                    {eventDetail.entityPreview.body ? (
                      <p className="whitespace-pre-wrap text-sm">
                        {eventDetail.entityPreview.body}
                      </p>
                    ) : null}
                    <dl className="grid grid-cols-2 gap-3">
                      {eventDetail.entityPreview.fields?.filter((field) => !/\bID\b/i.test(field.label) && !['0', 'No', 'None', 'null', 'false', ''].includes(field.value)).map((field) => (
                        <div key={field.label}>
                          <dt className="text-xs text-muted-foreground">
                            {field.label}
                          </dt>
                          <dd>{field.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ) : null}
                {snapshot ? (
                  <WhiteboardAuditSnapshot
                    boardId={snapshot.boardId}
                    atSeq={snapshot.atSeq}
                  />
                ) : null}
                {recordedFields.length ? <section className="space-y-3">
                  <h3 className="font-semibold">{eventDetail.action === 'CLUB_CHANNEL_MESSAGE_UPDATED' ? 'Changes' : 'Recorded information'}</h3>
                  <dl className="space-y-3">{recordedFields.map((field) => <div key={field.key}>
                    <dt className="text-xs text-muted-foreground">{field.label}</dt>
                    <dd className="whitespace-pre-wrap text-sm">{displayValue(field.value, eventDetail)}</dd>
                  </div>)}</dl>
                </section> : null}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="original">
                    <AccordionTrigger>Technical details</AccordionTrigger>
                    <AccordionContent>
                      <p className="mb-3 text-xs text-muted-foreground">
                        Complete action codes, IDs, timestamps, and saved
                        values. Name resolution above does not change the
                        original record.
                      </p>
                      <pre className="max-w-full whitespace-pre-wrap text-xs [overflow-wrap:anywhere]">
                        {JSON.stringify(
                          {
                            id: eventDetail.id,
                            actorId: eventDetail.actorId,
                            actor: eventDetail.actor,
                            action: eventDetail.action,
                            entityType: eventDetail.entityType,
                            entityId: eventDetail.entityId,
                            createdAt: eventDetail.createdAt,
                            meta: eventDetail.meta,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </>
            ) : (
              <AdminNotice message="This activity record could not be loaded." />
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
