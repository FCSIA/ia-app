'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
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
  auditRecordLabel,
  auditLabel,
  auditPersonName,
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
};
export function AuditDetailSheet({
  selectedEventId,
  onSelectedEventIdChange,
  eventDetail,
  isDetailLoading,
}: Props) {
  const snapshot = eventDetail ? whiteboardSnapshotTarget(eventDetail) : null;
  return (
    <Sheet
      open={!!selectedEventId}
      onOpenChange={(open) => !open && onSelectedEventIdChange(null)}
    >
      <SheetContent className="flex h-full w-full flex-col sm:max-w-xl">
        <SheetHeader className="shrink-0">
          <SheetTitle>Activity details</SheetTitle>
          <SheetDescription>
            Read what happened and the information saved with this activity.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="mt-4 min-h-0 flex-1">
          <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
            {isDetailLoading ? (
              <AdminNotice message="Loading activity details…" />
            ) : eventDetail ? (
              <>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      What happened
                    </dt>
                    <dd className="mt-1 font-semibold">
                      {auditActionLabel(eventDetail.action)}
                    </dd>
                  </div>
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
                    <dd className="mt-1">{auditPersonName(eventDetail)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Related record
                    </dt>
                    <dd className="mt-1">
                      {eventDetail.context?.title ??
                        auditRecordLabel(eventDetail.entityType)}
                      <span className="block text-xs text-muted-foreground">
                        {auditRecordLabel(eventDetail.entityType)}
                      </span>
                    </dd>
                  </div>
                </dl>
                {eventDetail.context?.references.length ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Related people and places (current names)
                    </p>
                    <dl className="grid gap-3 sm:grid-cols-2">
                      {eventDetail.context.references.map((ref) => (
                        <div key={`${ref.label}:${ref.id}`}>
                          <dt className="text-xs text-muted-foreground">
                            {ref.label}
                          </dt>
                          <dd>{ref.name}</dd>
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
                    {eventDetail.entityPreview.href ? (
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
                      {eventDetail.entityPreview.fields?.map((field) => (
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
                <section className="space-y-3">
                  <h3 className="font-semibold">Recorded information</h3>
                  {eventDetail.meta &&
                  typeof eventDetail.meta === 'object' &&
                  !Array.isArray(eventDetail.meta) ? (
                    <dl className="space-y-3">
                      {Object.entries(eventDetail.meta).map(([key, value]) => (
                        <div key={key}>
                          <dt className="text-xs text-muted-foreground">
                            {auditLabel(key)}
                          </dt>
                          <dd className="whitespace-pre-wrap text-sm">
                            {displayValue(value, eventDetail)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {eventDetail.meta == null
                        ? 'No additional information was recorded.'
                        : JSON.stringify(eventDetail.meta, null, 2)}
                    </p>
                  )}
                </section>
                <Accordion type="single" collapsible>
                  <AccordionItem value="original">
                    <AccordionTrigger>Original data and IDs</AccordionTrigger>
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
