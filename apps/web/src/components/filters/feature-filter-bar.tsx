'use client';

import { SlidersHorizontal, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  SearchInput,
  SearchToolbar,
  SearchToolbarRow,
} from '@/components/ui/search';
import {
  FilterToggleCount,
  FilterToggleGroup,
  FilterToggleIcon,
  FilterToggleItem,
} from '@/components/ui/filter-toggle-group';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type QuickFilterOption = {
  value: string;
  label: string;
  count?: number;
  icon?: ReactNode;
};

type FeatureFilterBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  chips?: QuickFilterOption[];
  activeChips?: string[];
  onChipToggle?: (value: string) => void;
  activeCount?: number;
  onClear?: () => void;
  advanced?: ReactNode;
  advancedOpen?: boolean;
  onAdvancedOpenChange?: (open: boolean) => void;
  className?: string;
};

export function FeatureFilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  chips = [],
  activeChips = [],
  onChipToggle,
  activeCount = 0,
  onClear,
  advanced,
  advancedOpen,
  onAdvancedOpenChange,
  className,
}: FeatureFilterBarProps) {
  const hasActive = activeCount > 0 || activeChips.length > 0 || !!search.trim();

  return (
    <SearchToolbar className={cn('p-0', className)}>
      <SearchToolbarRow>
        <SearchInput
          value={search}
          onValueChange={onSearchChange}
          placeholder={searchPlaceholder}
          className="min-w-0 flex-1"
        />
        <div className="flex shrink-0 items-center gap-2">
          {advanced ? (
            <Collapsible open={advancedOpen} onOpenChange={onAdvancedOpenChange}>
              <CollapsibleTrigger asChild>
                <Button variant="tertiary" size="sm" leadingIcon={SlidersHorizontal}>
                  Filters
                  {activeCount > 0 ? (
                    <Badge variant="solid" color="blue" className="ml-1.5 rounded-full px-1.5">
                      {activeCount}
                    </Badge>
                  ) : null}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          ) : null}
          {hasActive && onClear ? (
            <Button variant="ghost" size="sm" leadingIcon={X} onClick={onClear}>
              Clear
            </Button>
          ) : null}
        </div>
      </SearchToolbarRow>

      {chips.length > 0 ? (
        <FilterToggleGroup
          aria-label="Quick filters"
          value={activeChips}
          disabled={!onChipToggle}
          onValueChange={(nextValues) => {
            const changedValue =
              nextValues.find((value) => !activeChips.includes(value)) ??
              activeChips.find((value) => !nextValues.includes(value));
            if (changedValue) onChipToggle?.(changedValue);
          }}
        >
          {chips.map((chip) => (
            <FilterToggleItem key={chip.value} value={chip.value}>
              {chip.icon ? <FilterToggleIcon>{chip.icon}</FilterToggleIcon> : null}
              <span className="truncate">{chip.label}</span>
              {chip.count != null ? (
                <FilterToggleCount>{chip.count}</FilterToggleCount>
              ) : null}
            </FilterToggleItem>
          ))}
        </FilterToggleGroup>
      ) : null}

      {advanced ? (
        <Collapsible open={advancedOpen} onOpenChange={onAdvancedOpenChange}>
          <CollapsibleContent className="pt-2 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            <div className="rounded-xl bg-muted/25 p-3">
              {advanced}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </SearchToolbar>
  );
}
