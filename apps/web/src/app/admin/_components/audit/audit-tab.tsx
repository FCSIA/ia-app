'use client';

import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SearchInput, SearchToolbarRow } from '@/components/ui/search';
import { TabsSubtle, TabsSubtleItem, TabsSubtlePanel } from '@/components/ui/tabs-subtle';
import { useAdminAudit } from '../../_hooks/use-admin-audit';
import { AuditDetailSheet } from './audit-detail-sheet';
import { AuditFilters } from './audit-filters';
import { AuditTable } from './audit-table';
import { AuditAdvancedSearch } from './audit-advanced-search';

export function AuditTab() {
  const audit = useAdminAudit('audit');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const viewIndex = ['all', 'general', 'flex'].indexOf(audit.auditSubView);
  const filterCount =
    audit.auditFilterChips.length + (audit.advancedQuery ? 1 : 0);
  const filterSummary = [
    ...audit.auditFilterChips,
    audit.advancedQuery ? `Query: ${audit.advancedQuery}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <section aria-label="Audit activity" className="flex min-w-0 flex-col gap-4">
        <Collapsible
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          className="flex min-w-0 flex-col gap-4"
        >
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
            <TabsSubtle
              selectedIndex={viewIndex}
              idPrefix="audit-view"
              onSelect={(index) =>
                audit.setAuditSubView(index === 0 ? 'all' : index === 1 ? 'general' : 'flex')
              }
              aria-label="Activity view"
            >
              <TabsSubtleItem index={0} label="All" />
              <TabsSubtleItem index={1} label="General" />
              <TabsSubtleItem index={2} label="Flex & Events" />
            </TabsSubtle>
            <SearchToolbarRow className="min-w-0 flex-1 flex-row items-center gap-2">
              <SearchInput
                aria-label="Search audit activity"
                className="min-w-0 flex-1"
                value={audit.auditSearch}
                onValueChange={audit.setAuditSearch}
                placeholder="Search…"
              />
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="tertiary"
                  leadingIcon={SlidersHorizontal}
                  active={filtersOpen}
                >
                  Filters{filterCount ? ` (${filterCount})` : ''}
                </Button>
              </CollapsibleTrigger>
            </SearchToolbarRow>
          </div>
          <CollapsibleContent className="flex min-w-0 flex-col gap-4">
            <AuditFilters
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
            />
            <AuditAdvancedSearch
              draft={audit.advancedDraft}
              onDraftChange={audit.setAdvancedDraft}
              error={audit.advancedError}
              onApply={audit.applyAdvancedQuery}
            />
          </CollapsibleContent>
        </Collapsible>
        {filterSummary ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <p className="min-w-0 text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {filterSummary}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leadingIcon={X}
              onClick={audit.clearAuditFilters}
            >
              Clear filters
            </Button>
          </div>
        ) : null}
        {audit.advancedDraft.trim() !== audit.advancedQuery ? (
          <p role="status" className="text-xs text-muted-foreground">
            Query changes are not applied yet.
          </p>
        ) : null}
        {[0, 1, 2].map((index) => (
          <TabsSubtlePanel
            key={index}
            index={index}
            selectedIndex={viewIndex}
            idPrefix="audit-view"
          >
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
