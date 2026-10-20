'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TabsSubtle, TabsSubtleItem, TabsSubtlePanel } from '@/components/ui/tabs-subtle';
import { useAdminAudit } from '../../_hooks/use-admin-audit';
import { AuditDetailSheet } from './audit-detail-sheet';
import { AuditFilters } from './audit-filters';
import { AuditTable } from './audit-table';
import { AuditAdvancedSearch } from './audit-advanced-search';

export function AuditTab() {
  const audit = useAdminAudit('audit');
  const viewIndex = ['all', 'general', 'flex'].indexOf(audit.auditSubView);
  const actions = (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      <TabsSubtle
        selectedIndex={viewIndex}
        idPrefix="audit-view"
        onSelect={(index) =>
          audit.setAuditSubView(
            index === 0 ? 'all' : index === 1 ? 'general' : 'flex',
          )
        }
        aria-label="Activity view"
      >
        <TabsSubtleItem index={0} label="All" />
        <TabsSubtleItem index={1} label="General" />
        <TabsSubtleItem index={2} label="Flex & Events" />
      </TabsSubtle>
      {audit.hasActiveAuditFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leadingIcon={X}
          onClick={audit.clearAuditFilters}
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  );

  return (
    <>
      <section aria-label="Audit activity" className="min-w-0 space-y-4">
        {actions}
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
        <AuditAdvancedSearch
          draft={audit.advancedDraft}
          onDraftChange={audit.setAdvancedDraft}
          applied={audit.advancedQuery}
          error={audit.advancedError}
          onApply={audit.applyAdvancedQuery}
        />
        {[0, 1, 2].map((index) => (
          <TabsSubtlePanel key={index} index={index} selectedIndex={viewIndex} idPrefix="audit-view">
            <AuditTable
              isAuditLoading={audit.isAuditLoading}
              displayedAuditEvents={audit.displayedAuditEvents}
              auditStatus={audit.auditStatus}
              hasActiveAuditFilters={audit.hasActiveAuditFilters}
              onClearFilters={audit.clearAuditFilters}
              onInspect={audit.setSelectedAuditEventId}
              onLoadMore={audit.loadMoreAuditEvents}
            />
          </TabsSubtlePanel>
        ))}
      </section>

      <AuditDetailSheet
        selectedEventId={audit.selectedAuditEventId}
        onSelectedEventIdChange={audit.setSelectedAuditEventId}
        eventDetail={audit.auditEventDetail}
        isDetailLoading={audit.isAuditDetailLoading}
      />
    </>
  );
}
