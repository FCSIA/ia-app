'use client';

import { Badge } from '@/components/ui/badge';
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
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Search</label>
          <SearchInput
            value={auditSearch}
            onValueChange={onAuditSearchChange}
            placeholder="Action, actor, entity…"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Actor</label>
          <Input
            value={auditActor}
            onChange={(e) => onAuditActorChange(e.target.value)}
            placeholder="Name or unique ID"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Entity ID</label>
          <Input
            value={auditEntityId}
            onChange={(e) => onAuditEntityIdChange(e.target.value)}
            placeholder="Specific record ID"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Source</label>
          <Select
            value={auditActorScope}
            onValueChange={(value) => onAuditActorScopeChange(value as AuditActorScope)}
          >
            <SelectTrigger placeholder="Any source" />
            <SelectContent>
              <SelectItem index={0} value="ALL">
                All sources
              </SelectItem>
              <SelectItem index={1} value="USER">
                User actions
              </SelectItem>
              <SelectItem index={2} value="SYSTEM">
                System actions
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Action</label>
          <Select value={auditActionFilter} onValueChange={onAuditActionFilterChange}>
            <SelectTrigger placeholder="Any action" />
            <SelectContent>
              <SelectItem index={0} value="ALL">
                All actions
              </SelectItem>
              {auditActionOptions.map((action, index) => (
                <SelectItem index={index + 1} key={action} value={action}>
                  {action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Entity Type</label>
          <Select value={auditEntityTypeFilter} onValueChange={onAuditEntityTypeFilterChange}>
            <SelectTrigger placeholder="Any entity" />
            <SelectContent>
              <SelectItem index={0} value="ALL">
                All entity types
              </SelectItem>
              {auditEntityTypeOptions.map((entityType, index) => (
                <SelectItem index={index + 1} key={entityType} value={entityType}>
                  {entityType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <DatePicker
            value={auditStartDate}
            onChange={onAuditStartDateChange}
            buttonClassName="w-full"
            disabledDays={
              auditEndDate ? (date) => format(date, 'yyyy-MM-dd') > auditEndDate : undefined
            }
            allowClear
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <DatePicker
            value={auditEndDate}
            onChange={onAuditEndDateChange}
            buttonClassName="w-full"
            disabledDays={
              auditStartDate ? (date) => format(date, 'yyyy-MM-dd') < auditStartDate : undefined
            }
            allowClear
          />
        </div>
      </div>

      {auditFilterChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {auditFilterChips.map((chip) => (
            <Badge key={chip} variant="solid" size="sm">
              {chip}
            </Badge>
          ))}
        </div>
      ) : null}
    </>
  );
}
