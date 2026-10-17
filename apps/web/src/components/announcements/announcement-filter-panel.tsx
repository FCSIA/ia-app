'use client';

import { useId } from 'react';
import type { FeedFilters } from '@/components/announcements/announcement-feed-filters';
import { ANNOUNCEMENT_TAG_LABELS } from '@/components/announcements/announcement-card';
import {
  AccordionContent,
  AccordionGroup,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { CheckboxGroup, CheckboxItem } from '@/components/ui/checkbox-group';
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from '@/components/ui/select';

type FilterOption<T extends string | number> = { value: T; label: string };

type AnnouncementFilterPanelProps = {
  filters: FeedFilters;
  onFiltersChange: (patch: Partial<FeedFilters>) => void;
  availableTags: readonly string[];
  availableClubs: readonly { id: string; name: string }[];
  gradeOptions: readonly number[];
  pathwayOptions: readonly FilterOption<string>[];
};

const SCOPE_LABELS: Record<string, string> = {
  ...ANNOUNCEMENT_TAG_LABELS,
  INTERSECTION: 'Combined audience',
};

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: T;
  options: readonly FilterOption<T>[];
  onValueChange: (value: T) => void;
}) {
  const id = useId();

  return (
    <Field className="min-w-0 gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select size="compact" value={value} onValueChange={(next) => onValueChange(next as T)}>
        <SelectTrigger id={id} className="min-w-0 w-full" />
        <SelectContent>
          <SelectGroup>
            {options.map((option, index) => (
              <SelectItem key={option.value} index={index} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function FilterFacet<T extends string | number>({
  label,
  value,
  index,
  options,
  selected,
  onSelectionChange,
}: {
  label: string;
  value: string;
  index: number;
  options: readonly FilterOption<T>[];
  selected: readonly T[];
  onSelectionChange: (selection: T[]) => void;
}) {
  const summary = selected.length === 0
    ? 'Any'
    : selected.length === 1
      ? options.find((option) => option.value === selected[0])?.label ?? '1 selected'
      : `${selected.length} selected`;

  return (
    <AccordionItem value={value} index={index}>
      <AccordionTrigger>
        <span className="flex min-w-0 items-baseline justify-between gap-3">
          <span className="shrink-0">{label}</span>
          <span className="truncate">{summary}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <FieldSet className="min-w-0 gap-0">
          <FieldLegend className="sr-only">{label}</FieldLegend>
          <CheckboxGroup
            className="w-full"
            checkedIndices={new Set(options.flatMap((option, optionIndex) =>
              selected.includes(option.value) ? [optionIndex] : [],
            ))}
          >
            {options.map((option, optionIndex) => (
              <CheckboxItem
                key={option.value}
                index={optionIndex}
                label={option.label}
                checked={selected.includes(option.value)}
                onToggle={() => onSelectionChange(selected.includes(option.value)
                  ? selected.filter((item) => item !== option.value)
                  : [...selected, option.value])}
              />
            ))}
          </CheckboxGroup>
        </FieldSet>
      </AccordionContent>
    </AccordionItem>
  );
}

export function AnnouncementFilterPanel({
  filters,
  onFiltersChange,
  availableTags,
  availableClubs,
  gradeOptions,
  pathwayOptions,
}: AnnouncementFilterPanelProps) {
  // Keep an active scope reachable if the loaded feed changes while filtering.
  const scopes = [...new Set([...availableTags, ...(filters.activeTag ? [filters.activeTag] : [])])];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <FieldGroup className="grid grid-cols-2 gap-3 px-3">
        <FilterSelect<FeedFilters['readFilter']>
          label="Read"
          value={filters.readFilter}
          options={[
            { value: 'all', label: 'Any' },
            { value: 'unread', label: 'Unread' },
            { value: 'read', label: 'Read' },
          ]}
          onValueChange={(readFilter) => onFiltersChange({ readFilter })}
        />
        <FilterSelect<FeedFilters['savedFilter']>
          label="Saved"
          value={filters.savedFilter}
          options={[
            { value: 'all', label: 'Any' },
            { value: 'saved', label: 'Saved' },
          ]}
          onValueChange={(savedFilter) => onFiltersChange({ savedFilter })}
        />
        <FieldGroup className="col-span-2">
          <FilterSelect
            label="Audience"
            value={filters.activeTag ?? 'all'}
            options={[
              { value: 'all', label: 'Any' },
              ...scopes.map((scope) => ({
                value: scope,
                label: SCOPE_LABELS[scope] ?? scope.replaceAll('_', ' '),
              })),
            ]}
            onValueChange={(scope) => onFiltersChange({ activeTag: scope === 'all' ? null : scope })}
          />
        </FieldGroup>
      </FieldGroup>
      <AccordionGroup type="multiple" className="w-full">
        <FilterFacet
          label="Grade"
          value="grade"
          index={0}
          options={gradeOptions.map((grade) => ({ value: grade, label: `Grade ${grade}` }))}
          selected={filters.selectedGrades}
          onSelectionChange={(selectedGrades) => onFiltersChange({ selectedGrades })}
        />
        <FilterFacet
          label="Major pathway"
          value="major-pathway"
          index={1}
          options={pathwayOptions}
          selected={filters.selectedMajorPathways}
          onSelectionChange={(selectedMajorPathways) => onFiltersChange({ selectedMajorPathways })}
        />
        <FilterFacet
          label="Minor pathway"
          value="minor-pathway"
          index={2}
          options={pathwayOptions}
          selected={filters.selectedMinorPathways}
          onSelectionChange={(selectedMinorPathways) => onFiltersChange({ selectedMinorPathways })}
        />
        {availableClubs.length > 0 ? (
          <FilterFacet
            label="Club"
            value="club"
            index={3}
            options={availableClubs.map((club) => ({ value: club.id, label: club.name }))}
            selected={filters.selectedClubIds}
            onSelectionChange={(selectedClubIds) => onFiltersChange({ selectedClubIds })}
          />
        ) : null}
      </AccordionGroup>
    </div>
  );
}
