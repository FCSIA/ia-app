'use client';

import { format } from 'date-fns';
import { Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AUDIT_FETCH_LIMIT } from '../../_lib/admin-utils';
import type { AuditEventRecord } from '../../_lib/types';

type AuditTableProps = {
  isAuditLoading: boolean;
  displayedAuditEvents: AuditEventRecord[];
  auditEvents: AuditEventRecord[];
  auditStatus: 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted';
  hasActiveAuditFilters: boolean;
  onClearFilters: () => void;
  onInspect: (eventId: string) => void;
  onLoadMore: (numItems: number) => void;
};

export function AuditTable({
  isAuditLoading,
  displayedAuditEvents,
  auditEvents,
  auditStatus,
  hasActiveAuditFilters,
  onClearFilters,
  onInspect,
  onLoadMore,
}: AuditTableProps) {
  return (
    <>
      <p className="text-xs text-muted-foreground">
        Showing {displayedAuditEvents.length} matching event{displayedAuditEvents.length === 1 ? '' : 's'}
        {auditEvents.length > displayedAuditEvents.length ? ` from ${auditEvents.length} loaded` : ''}.
      </p>

      {isAuditLoading ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Loading audit events…
                  </div>
                ) : displayedAuditEvents.length > 0 ? (
                  <>
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        {['Time', 'Actor', 'Action', 'Entity', 'Inspect'].map((h) => (
                          <TableHead key={h} className="px-4 py-3 text-xs uppercase tracking-wide">
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedAuditEvents.map((event) => {
                        const meta = event.meta ?? {};
                        const contextHint =
                          (typeof meta.clubName === 'string' && typeof meta.channelName === 'string'
                            ? `${meta.clubName} · #${meta.channelName}`
                            : typeof meta.title === 'string'
                              ? meta.title
                              : typeof meta.name === 'string'
                                ? meta.name
                                : typeof meta.bodyPreview === 'string'
                                  ? meta.bodyPreview
                                  : null) ?? null;

                        return (
                          <TableRow key={event.id} className="hover:bg-muted/30">
                            <TableCell className="px-4 py-3 align-top text-xs whitespace-nowrap font-mono text-muted-foreground">
                              {format(new Date(event.createdAt), 'MMM d, yyyy')}
                              <div className="mt-1">{format(new Date(event.createdAt), 'h:mm:ss a')}</div>
                            </TableCell>
                            <TableCell className="px-4 py-3 align-top text-xs">
                              <div className="font-medium text-foreground">
                                {event.actor
                                  ? `${event.actor.firstName} ${event.actor.lastName}`
                                  : 'System'}
                              </div>
                              {event.actor?.uniqueId ? (
                                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                                  {event.actor.uniqueId}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell className="px-4 py-3 align-top">
                              <Badge
                                variant="dot"
                                className="font-mono text-[11px] text-accent-600 dark:text-accent-400"
                              >
                                {event.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4 py-3 align-top text-xs text-muted-foreground">
                              <div className="font-medium text-foreground">
                                {event.entityType}
                                {event.entityId ? ` #${event.entityId.slice(0, 8)}` : ''}
                              </div>
                              {contextHint ? (
                                <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">
                                  {contextHint}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell className="px-4 py-3 align-top">
                              <Button
                                type="button"
                                size="sm"
                                variant="tertiary"
                                className="rounded-xl"
                                onClick={() => onInspect(event.id)}
                              >
                                <Eye className="mr-1.5 size-4" />
                                Inspect
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {auditStatus !== 'Exhausted' ? (
                    <div className="flex justify-center pt-4">
                      <Button
                        type="button"
                        variant="tertiary"
                        className="rounded-xl"
                        disabled={auditStatus !== 'CanLoadMore'}
                        onClick={() => onLoadMore(AUDIT_FETCH_LIMIT)}
                      >
                        {auditStatus === 'LoadingMore' ? 'Loading...' : 'Load more'}
                      </Button>
                    </div>
                  ) : null}
                  </>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground text-sm">
                      {hasActiveAuditFilters ? 'No audit events match these filters' : 'No audit events'}
                    </p>
                    {hasActiveAuditFilters ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearFilters}
                        className="mt-1 font-semibold text-accent-500"
                      >
                        Clear filters
                      </Button>
                    ) : null}
                  </div>
                )}
    </>
  );
}
