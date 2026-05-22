'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import { useAdminAudit } from '../../_hooks/use-admin-audit';
import { AuditDetailSheet } from './audit-detail-sheet';
import { AuditFilters } from './audit-filters';
import { AuditTable } from './audit-table';

export function AuditTab() {
  const audit = useAdminAudit('audit');

  return (
    <>
      <Card>
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Audit Log</CardTitle>
            <div className="flex items-center gap-2">
              <TabsSubtle
                selectedIndex={audit.auditSubView === 'general' ? 0 : 1}
                onSelect={(index) => audit.setAuditSubView(index === 0 ? 'general' : 'flex')}
                className="rounded-full border border-border/70 bg-muted/30 px-1"
              >
                <TabsSubtleItem index={0} label="General" className="py-1.5" />
                <TabsSubtleItem index={1} label="Flex & Events" className="py-1.5" />
              </TabsSubtle>
              {audit.hasActiveAuditFilters ? (
                <Button type="button" variant="ghost" size="sm" onClick={audit.clearAuditFilters}>
                  <X className="mr-1 size-4" />
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <AuditFilters
            auditSearch={audit.auditSearch}
            onAuditSearchChange={audit.setAuditSearch}
            auditActor={audit.auditActor}
            onAuditActorChange={audit.setAuditActor}
            auditEntityId={audit.auditEntityId}
            onAuditEntityIdChange={audit.setAuditEntityId}
            auditActorScope={audit.auditActorScope}
            onAuditActorScopeChange={audit.setAuditActorScope}
            auditActionFilter={audit.auditActionFilter}
            onAuditActionFilterChange={audit.setAuditActionFilter}
            auditEntityTypeFilter={audit.auditEntityTypeFilter}
            onAuditEntityTypeFilterChange={audit.setAuditEntityTypeFilter}
            auditStartDate={audit.auditStartDate}
            auditEndDate={audit.auditEndDate}
            onAuditStartDateChange={audit.setAuditStartDateWithBounds}
            onAuditEndDateChange={audit.setAuditEndDateWithBounds}
            auditActionOptions={audit.auditActionOptions}
            auditEntityTypeOptions={audit.auditEntityTypeOptions}
            auditFilterChips={audit.auditFilterChips}
          />
          <AuditTable
            isAuditLoading={audit.isAuditLoading}
            displayedAuditEvents={audit.displayedAuditEvents}
            auditEvents={audit.auditEvents}
            auditStatus={audit.auditStatus}
            hasActiveAuditFilters={audit.hasActiveAuditFilters}
            onClearFilters={audit.clearAuditFilters}
            onInspect={audit.setSelectedAuditEventId}
            onLoadMore={audit.loadMoreAuditEvents}
          />
        </CardContent>
      </Card>

      <AuditDetailSheet
        selectedEventId={audit.selectedAuditEventId}
        onSelectedEventIdChange={audit.setSelectedAuditEventId}
        eventDetail={audit.auditEventDetail}
        isDetailLoading={audit.isAuditDetailLoading}
      />
    </>
  );
}
