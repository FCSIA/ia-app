'use client';

import { auditActionLabel, auditRecordLabel } from '~/apps/shared/audit';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { format } from 'date-fns';
import type { AuditActorScope } from '../../_lib/types';

type AuditFiltersProps = {
  auditSearch: string;
  onAuditSearchChange: (value: string) => void;
  auditActor: string;
  onAuditActorChange: (value: string) => void;
  auditEntityId: string;
  onAuditEntityIdChange: (value: string) => void;
  auditActorScope: AuditActorScope;
  onAuditActorScopeChange: (value: AuditActorScope) => void;
  auditActionFilter: string;
  onAuditActionFilterChange: (value: string) => void;
  auditEntityTypeFilter: string;
  onAuditEntityTypeFilterChange: (value: string) => void;
  auditStartDate: string;
  auditEndDate: string;
  onAuditStartDateChange: (value: string) => void;
  onAuditEndDateChange: (value: string) => void;
  auditActionOptions: string[];
  auditEntityTypeOptions: string[];
  auditFilterChips: string[];
};

export function AuditFilters({
  auditSearch,
  onAuditSearchChange,
  auditActor,
  onAuditActorChange,
  auditEntityId,
  onAuditEntityIdChange,
  auditActorScope,
  onAuditActorScopeChange,
  auditActionFilter,
  onAuditActionFilterChange,
  auditEntityTypeFilter,
  onAuditEntityTypeFilterChange,
  auditStartDate,
  auditEndDate,
  onAuditStartDateChange,
  onAuditEndDateChange,
  auditActionOptions,
  auditEntityTypeOptions,
  auditFilterChips,
}: AuditFiltersProps) {
  return (
    <>
      <div className="space-y-3">
        <div className="min-w-0 space-y-2">
          <label
            htmlFor="audit-search"
            className="text-xs font-medium text-muted-foreground"
          >
            Search
          </label>
          <SearchInput
            id="audit-search"
            value={auditSearch}
            onValueChange={onAuditSearchChange}
            placeholder="Names, actions, records, or message text…"
          />
        </div>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="filters">
            <AccordionTrigger>Filters</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-4">
                <div className="min-w-0 space-y-2">
                  <label
                    htmlFor="audit-person"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Person
                  </label>
                  <Input
                    id="audit-person"
                    value={auditActor}
                    onChange={(e) => onAuditActorChange(e.target.value)}
                    placeholder="Full name or person ID"
                  />
                </div>

                <div className="min-w-0 space-y-2">
                  <label
                    htmlFor="audit-record"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Record ID
                  </label>
                  <Input
                    id="audit-record"
                    value={auditEntityId}
                    onChange={(e) => onAuditEntityIdChange(e.target.value)}
                    placeholder="Specific record ID"
                  />
                </div>

                <div className="min-w-0 space-y-2">
                  <label
                    htmlFor="audit-source"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Source
                  </label>
                  <Select
                    value={auditActorScope}
                    onValueChange={(value) =>
                      onAuditActorScopeChange(value as AuditActorScope)
                    }
                  >
                    <SelectTrigger id="audit-source" />
                    <SelectContent>
                      <SelectItem index={0} value="ALL">
                        All sources
                      </SelectItem>
                      <SelectItem index={1} value="USER">
                        People
                      </SelectItem>
                      <SelectItem index={2} value="SYSTEM">
                        Automatic activity
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0 space-y-2">
                  <label
                    htmlFor="audit-action"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Action
                  </label>
                  <Select
                    value={auditActionFilter}
                    onValueChange={onAuditActionFilterChange}
                  >
                    <SelectTrigger id="audit-action" />
                    <SelectContent>
                      <SelectItem index={0} value="ALL">
                        All actions
                      </SelectItem>
                      {auditActionOptions.map((action, index) => (
                        <SelectItem
                          index={index + 1}
                          key={action}
                          value={action}
                        >
                          {auditActionLabel(action)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0 space-y-2">
                  <label
                    htmlFor="audit-type"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Record type
                  </label>
                  <Select
                    value={auditEntityTypeFilter}
                    onValueChange={onAuditEntityTypeFilterChange}
                  >
                    <SelectTrigger id="audit-type" />
                    <SelectContent>
                      <SelectItem index={0} value="ALL">
                        All record types
                      </SelectItem>
                      {auditEntityTypeOptions.map((entityType, index) => (
                        <SelectItem
                          index={index + 1}
                          key={entityType}
                          value={entityType}
                        >
                          {auditRecordLabel(entityType)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div
                  role="group"
                  aria-labelledby="audit-from-label"
                  className="min-w-0 space-y-2"
                >
                  <label
                    id="audit-from-label"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    From
                  </label>
                  <DatePicker
                    placeholder="From date"
                    value={auditStartDate}
                    onChange={onAuditStartDateChange}
                    buttonClassName="w-full"
                    disabledDays={
                      auditEndDate
                        ? (date) => format(date, 'yyyy-MM-dd') > auditEndDate
                        : undefined
                    }
                    allowClear
                  />
                </div>

                <div
                  role="group"
                  aria-labelledby="audit-to-label"
                  className="min-w-0 space-y-2"
                >
                  <label
                    id="audit-to-label"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    To
                  </label>
                  <DatePicker
                    placeholder="To date"
                    value={auditEndDate}
                    onChange={onAuditEndDateChange}
                    buttonClassName="w-full"
                    disabledDays={
                      auditStartDate
                        ? (date) => format(date, 'yyyy-MM-dd') < auditStartDate
                        : undefined
                    }
                    allowClear
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
      {auditFilterChips.length > 0 ? (
        <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {auditFilterChips.join(' · ')}
        </p>
      ) : null}
    </>
  );
}
