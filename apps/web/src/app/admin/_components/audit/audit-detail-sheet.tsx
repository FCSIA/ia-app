'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { AdminMetric, AdminNotice } from '../admin-ui';
import type { AuditEventDetail } from '../../_lib/types';

type AuditDetailSheetProps = {
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
}: AuditDetailSheetProps) {
  return (
    <Sheet open={!!selectedEventId} onOpenChange={(open) => !open && onSelectedEventIdChange(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Audit Event Details</SheetTitle>
          <SheetDescription>
            Inspect the recorded action, resolved entity context, and raw metadata captured at the time.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {isDetailLoading ? (
            <AdminNotice message="Loading audit context..." />
          ) : eventDetail ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminMetric label="Action" value={<span className="font-mono text-sm">{eventDetail.action}</span>} compact />
                <AdminMetric label="When" value={format(new Date(eventDetail.createdAt), 'PPP p')} compact />
                <AdminMetric
                  label="Actor"
                  value={eventDetail.actor ? `${eventDetail.actor.firstName} ${eventDetail.actor.lastName}` : 'System'}
                  compact
                />
                <AdminMetric
                  label="Entity"
                  value={eventDetail.entityType}
                  detail={eventDetail.entityId ? <span className="font-mono">{eventDetail.entityId}</span> : undefined}
                  compact
                />
              </div>

              {eventDetail.entityPreview ? (
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Resolved context
                      </p>
                      <h3 className="mt-1.5 text-base font-semibold text-foreground">
                        {eventDetail.entityPreview.title}
                      </h3>
                      {eventDetail.entityPreview.subtitle ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {eventDetail.entityPreview.subtitle}
                        </p>
                      ) : null}
                    </div>
                    {eventDetail.entityPreview.href ? (
                      <Button asChild variant="tertiary" size="sm">
                        <Link href={eventDetail.entityPreview.href}>
                          {eventDetail.entityPreview.hrefLabel || 'Open record'}
                        </Link>
                      </Button>
                    ) : null}
                  </div>

                  {eventDetail.entityPreview.body ? (
                    <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-sm leading-6 text-foreground/90">
                      {eventDetail.entityPreview.body}
                    </div>
                  ) : null}

                  {eventDetail.entityPreview.fields?.length ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {eventDetail.entityPreview.fields.map((field) => (
                        <AdminMetric
                          key={`${field.label}-${field.value}`}
                          label={field.label}
                          value={field.value}
                          compact
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {eventDetail.meta ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Raw metadata
                  </p>
                  <pre className="overflow-x-auto rounded-lg border bg-muted/20 p-3 text-xs leading-6 text-foreground/80">
                    {JSON.stringify(eventDetail.meta, null, 2)}
                  </pre>
                </div>
              ) : null}
            </>
          ) : (
            <AdminNotice message="This audit event could not be loaded." />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
