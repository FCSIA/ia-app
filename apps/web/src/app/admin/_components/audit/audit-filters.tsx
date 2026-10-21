'use client';

import { auditActionLabel, auditRecordLabel } from '~/apps/shared/audit';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { format } from 'date-fns';
import type { AuditActorScope } from '../../_lib/types';

type AuditFiltersProps = {
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
};

export function AuditFilters({
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
}: AuditFiltersProps) {
  return (
    <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Field className="min-w-0 gap-2">
        <FieldLabel htmlFor="audit-person">Person</FieldLabel>
        <Input
          id="audit-person"
          value={auditActor}
          onChange={(e) => onAuditActorChange(e.target.value)}
          placeholder="Full name or person ID"
        />
      </Field>
      <Field className="min-w-0 gap-2">
        <FieldLabel htmlFor="audit-action">Action</FieldLabel>
        <Select value={auditActionFilter} onValueChange={onAuditActionFilterChange}>
          <SelectTrigger id="audit-action" />
          <SelectContent>
            <SelectItem index={0} value="ALL">
              All actions
            </SelectItem>
            {auditActionOptions.map((action, index) => (
              <SelectItem index={index + 1} key={action} value={action}>
                {auditActionLabel(action)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field className="min-w-0 gap-2">
        <FieldLabel htmlFor="audit-type">Record type</FieldLabel>
        <Select value={auditEntityTypeFilter} onValueChange={onAuditEntityTypeFilterChange}>
          <SelectTrigger id="audit-type" />
          <SelectContent>
            <SelectItem index={0} value="ALL">
              All record types
            </SelectItem>
            {auditEntityTypeOptions.map((entityType, index) => (
              <SelectItem index={index + 1} key={entityType} value={entityType}>
                {auditRecordLabel(entityType)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field className="min-w-0 gap-2">
        <FieldLabel htmlFor="audit-source">Source</FieldLabel>
        <Select
          value={auditActorScope}
          onValueChange={(value) => onAuditActorScopeChange(value as AuditActorScope)}
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
      </Field>
      <Field className="min-w-0 gap-2 md:col-span-2">
        <FieldLabel htmlFor="audit-record">Record ID</FieldLabel>
        <Input
          id="audit-record"
          value={auditEntityId}
          onChange={(e) => onAuditEntityIdChange(e.target.value)}
          placeholder="Specific record ID"
        />
      </Field>
      <Field className="min-w-0 gap-2" aria-labelledby="audit-from-label">
        <FieldLabel id="audit-from-label">From</FieldLabel>
        <DatePicker
          placeholder="From date"
          value={auditStartDate}
          onChange={onAuditStartDateChange}
          buttonClassName="w-full"
          disabledDays={
            auditEndDate ? (date) => format(date, 'yyyy-MM-dd') > auditEndDate : undefined
          }
          allowClear
        />
      </Field>
      <Field className="min-w-0 gap-2" aria-labelledby="audit-to-label">
        <FieldLabel id="audit-to-label">To</FieldLabel>
        <DatePicker
          placeholder="To date"
          value={auditEndDate}
          onChange={onAuditEndDateChange}
          buttonClassName="w-full"
          disabledDays={
            auditStartDate ? (date) => format(date, 'yyyy-MM-dd') < auditStartDate : undefined
          }
          allowClear
        />
      </Field>
    </FieldGroup>
  );
}
