'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import { useAdminAudit } from '../../_hooks/use-admin-audit';
import { AdminPanel } from '../admin-ui';
import { AuditDetailSheet } from './audit-detail-sheet';
import { AuditFilters } from './audit-filters';
import { AuditTable } from './audit-table';
import { AuditAdvancedSearch } from './audit-advanced-search';

export function AuditTab() {
  const audit = useAdminAudit('audit');
  const actions = (
    <>
      <TabsSubtle
        selectedIndex={['all', 'general', 'flex'].indexOf(audit.auditSubView)}
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
          Clear
        </Button>
      ) : null}
    </>
  );

  return (
    <>
      <AdminPanel
        title="Audit Log"
        actions={actions}
        contentClassName="space-y-5"
      >
        <p className="text-sm text-muted-foreground">
          Who did what, and when. Open Details for the complete recorded
          information. All activity includes every category.
        </p>
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
      </AdminPanel>

      <AuditDetailSheet
        selectedEventId={audit.selectedAuditEventId}
        onSelectedEventIdChange={audit.setSelectedAuditEventId}
        eventDetail={audit.auditEventDetail}
        isDetailLoading={audit.isAuditDetailLoading}
      />
    </>
  );
}
