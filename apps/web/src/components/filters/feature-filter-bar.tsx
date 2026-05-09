'use client';

import { SlidersHorizontal, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  SearchInput,
  SearchToolbar,
  SearchToolbarFilters,
  SearchToolbarRow,
} from '@/components/ui/search';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type FilterChip = {
  value: string;
  label: string;
  count?: number;
  icon?: ReactNode;
};

type FeatureFilterBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  chips?: FilterChip[];
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
    <SearchToolbar className={cn('rounded-lg border bg-card p-3', className)}>
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
                <Button variant="tertiary" size="sm">
                  <SlidersHorizontal className="mr-1.5 size-4" />
                  Filters
                  {activeCount > 0 ? (
                    <Badge variant="solid" className="ml-1.5 rounded-full px-1.5">
                      {activeCount}
                    </Badge>
                  ) : null}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          ) : null}
          {hasActive && onClear ? (
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X className="mr-1.5 size-4" />
              Clear
            </Button>
          ) : null}
        </div>
      </SearchToolbarRow>

      {chips.length > 0 ? (
        <SearchToolbarFilters>
          {chips.map((chip) => {
            const active = activeChips.includes(chip.value);
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => onChipToggle?.(chip.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {chip.icon}
                <span>{chip.label}</span>
                {chip.count != null ? (
                  <span className="text-muted-foreground/80">{chip.count}</span>
                ) : null}
              </button>
            );
          })}
        </SearchToolbarFilters>
      ) : null}

      {advanced ? (
        <Collapsible open={advancedOpen} onOpenChange={onAdvancedOpenChange}>
          <CollapsibleContent className="pt-2">
            {advanced}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </SearchToolbar>
  );
}
