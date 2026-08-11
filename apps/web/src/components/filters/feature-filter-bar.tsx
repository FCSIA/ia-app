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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type QuickFilterOption = {
  value: string;
  label: string;
  count?: number;
  icon?: ReactNode;
};

const EMPTY_QUICK_FILTERS: QuickFilterOption[] = [];
const EMPTY_ACTIVE_CHIPS: string[] = [];

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
  advancedTitle?: string;
  advancedDescription?: string;
  className?: string;
};

export function FeatureFilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  chips = EMPTY_QUICK_FILTERS,
  activeChips = EMPTY_ACTIVE_CHIPS,
  onChipToggle,
  activeCount = 0,
  onClear,
  advanced,
  advancedOpen,
  onAdvancedOpenChange,
  advancedTitle = 'Filters',
  advancedDescription,
  className,
}: FeatureFilterBarProps) {
  const hasActive =
    activeCount > 0 || activeChips.length > 0 || !!search.trim();
  const activeChipSet = new Set(activeChips);

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
            <Popover open={advancedOpen} onOpenChange={onAdvancedOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  variant="tertiary"
                  size="sm"
                  leadingIcon={SlidersHorizontal}
                  active={advancedOpen}
                >
                  Filters
                  {activeCount > 0 ? (
                    <Badge variant="solid" color="blue" size="sm">
                      {activeCount}
                    </Badge>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-[min(34rem,calc(100vw-2rem))] p-0"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {advancedTitle}
                    </p>
                    {advancedDescription ? (
                      <p className="text-xs text-muted-foreground">
                        {advancedDescription}
                      </p>
                    ) : null}
                  </div>
                  {activeCount > 0 && onClear ? (
                    <Button variant="ghost" size="sm" onClick={onClear}>
                      Reset
                    </Button>
                  ) : null}
                </div>
                <div className="border-t border-border/70 p-4">{advanced}</div>
              </PopoverContent>
            </Popover>
          ) : null}
          {hasActive && onClear ? (
            <Tooltip content="Clear search and filters">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClear}
                aria-label="Clear search and filters"
              >
                <X />
              </Button>
            </Tooltip>
          ) : null}
        </div>
      </SearchToolbarRow>

      {chips.length > 0 ? (
        <FilterToggleGroup
          aria-label="Quick filters"
          value={activeChips}
          disabled={!onChipToggle}
          onValueChange={(nextValues) => {
            const nextValueSet = new Set(nextValues);
            const changedValue =
              nextValues.find((value) => !activeChipSet.has(value)) ??
              activeChips.find((value) => !nextValueSet.has(value));
            if (changedValue) onChipToggle?.(changedValue);
          }}
        >
          {chips.map((chip) => (
            <FilterToggleItem key={chip.value} value={chip.value}>
              {chip.icon ? (
                <FilterToggleIcon>{chip.icon}</FilterToggleIcon>
              ) : null}
              <span className="truncate">{chip.label}</span>
              {chip.count != null ? (
                <FilterToggleCount>{chip.count}</FilterToggleCount>
              ) : null}
            </FilterToggleItem>
          ))}
        </FilterToggleGroup>
      ) : null}
    </SearchToolbar>
  );
}
