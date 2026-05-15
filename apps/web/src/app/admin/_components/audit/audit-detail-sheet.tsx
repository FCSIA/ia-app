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
                    Inspect the recorded action, the resolved entity context, and the raw metadata captured at the time.
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {isDetailLoading ? (
                    <div className="text-sm text-muted-foreground">Loading audit context…</div>
                  ) : eventDetail ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Action</p>
                          <p className="mt-2 font-mono text-sm text-foreground">{eventDetail.action}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">When</p>
                          <p className="mt-2 text-sm text-foreground">
                            {format(new Date(eventDetail.createdAt), 'PPP p')}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Actor</p>
                          <p className="mt-2 text-sm text-foreground">
                            {eventDetail.actor
                              ? `${eventDetail.actor.firstName} ${eventDetail.actor.lastName}`
                              : 'System'}
                          </p>
                          {eventDetail.actor?.uniqueId ? (
                            <p className="mt-1 font-mono text-xs text-muted-foreground">
                              {eventDetail.actor.uniqueId}
                            </p>
                          ) : null}
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Entity</p>
                          <p className="mt-2 text-sm text-foreground">{eventDetail.entityType}</p>
                          {eventDetail.entityId ? (
                            <p className="mt-1 font-mono text-xs text-muted-foreground">
                              {eventDetail.entityId}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {eventDetail.entityPreview ? (
                        <div className="rounded-3xl border border-border/70 bg-card/95 p-5">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                Resolved context
                              </p>
                              <h3 className="mt-2 text-lg font-semibold text-foreground">
                                {eventDetail.entityPreview.title}
                              </h3>
                              {eventDetail.entityPreview.subtitle ? (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {eventDetail.entityPreview.subtitle}
                                </p>
                              ) : null}
                            </div>
                            {eventDetail.entityPreview.href ? (
                              <Button asChild variant="tertiary" size="sm" className="rounded-xl">
                                <Link href={eventDetail.entityPreview.href}>
                                  {eventDetail.entityPreview.hrefLabel || 'Open record'}
                                </Link>
                              </Button>
                            ) : null}
                          </div>

                          {eventDetail.entityPreview.body ? (
                            <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm leading-6 text-foreground/90">
                              {eventDetail.entityPreview.body}
                            </div>
                          ) : null}

                          {eventDetail.entityPreview.fields?.length ? (
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              {eventDetail.entityPreview.fields.map((field) => (
                                <div key={`${field.label}-${field.value}`} className="rounded-2xl border border-border/70 bg-muted/15 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                    {field.label}
                                  </p>
                                  <p className="mt-2 text-sm text-foreground">{field.value}</p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {eventDetail.meta ? (
                        <div className="space-y-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Raw metadata
                          </p>
                          <pre className="overflow-x-auto rounded-2xl border border-border/70 bg-muted/20 p-4 text-xs leading-6 text-foreground/80">
                            {JSON.stringify(eventDetail.meta, null, 2)}
                          </pre>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      This audit event could not be loaded.
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
  );
}
