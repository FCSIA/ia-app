'use client';

import { SlidersHorizontal, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import type { BadgeColor } from '@/components/ui/badge';
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
  color?: BadgeColor;
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
  const chipColorStyles: Record<BadgeColor, { active: string; idle: string; count: string }> = {
    gray: {
      active: 'border-border bg-muted text-foreground shadow-sm',
      idle: 'border-border/70 bg-background text-muted-foreground hover:bg-muted/70 hover:text-foreground',
      count: 'bg-background/80 text-muted-foreground',
    },
    red: {
      active: 'border-red-500/35 bg-red-500/15 text-red-700 shadow-sm dark:text-red-300',
      idle: 'border-red-500/20 bg-red-500/5 text-red-700/80 hover:bg-red-500/12 dark:text-red-300/80',
      count: 'bg-red-500/15 text-red-700 dark:text-red-200',
    },
    orange: {
      active: 'border-orange-500/35 bg-orange-500/15 text-orange-700 shadow-sm dark:text-orange-300',
      idle: 'border-orange-500/20 bg-orange-500/5 text-orange-700/80 hover:bg-orange-500/12 dark:text-orange-300/80',
      count: 'bg-orange-500/15 text-orange-700 dark:text-orange-200',
    },
    amber: {
      active: 'border-amber-500/35 bg-amber-500/15 text-amber-700 shadow-sm dark:text-amber-300',
      idle: 'border-amber-500/20 bg-amber-500/5 text-amber-700/80 hover:bg-amber-500/12 dark:text-amber-300/80',
      count: 'bg-amber-500/15 text-amber-700 dark:text-amber-200',
    },
    yellow: {
      active: 'border-yellow-500/35 bg-yellow-500/15 text-yellow-700 shadow-sm dark:text-yellow-300',
      idle: 'border-yellow-500/20 bg-yellow-500/5 text-yellow-700/80 hover:bg-yellow-500/12 dark:text-yellow-300/80',
      count: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-200',
    },
    lime: {
      active: 'border-lime-500/35 bg-lime-500/15 text-lime-700 shadow-sm dark:text-lime-300',
      idle: 'border-lime-500/20 bg-lime-500/5 text-lime-700/80 hover:bg-lime-500/12 dark:text-lime-300/80',
      count: 'bg-lime-500/15 text-lime-700 dark:text-lime-200',
    },
    green: {
      active: 'border-green-500/35 bg-green-500/15 text-green-700 shadow-sm dark:text-green-300',
      idle: 'border-green-500/20 bg-green-500/5 text-green-700/80 hover:bg-green-500/12 dark:text-green-300/80',
      count: 'bg-green-500/15 text-green-700 dark:text-green-200',
    },
    emerald: {
      active: 'border-emerald-500/35 bg-emerald-500/15 text-emerald-700 shadow-sm dark:text-emerald-300',
      idle: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700/80 hover:bg-emerald-500/12 dark:text-emerald-300/80',
      count: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200',
    },
    teal: {
      active: 'border-teal-500/35 bg-teal-500/15 text-teal-700 shadow-sm dark:text-teal-300',
      idle: 'border-teal-500/20 bg-teal-500/5 text-teal-700/80 hover:bg-teal-500/12 dark:text-teal-300/80',
      count: 'bg-teal-500/15 text-teal-700 dark:text-teal-200',
    },
    cyan: {
      active: 'border-cyan-500/35 bg-cyan-500/15 text-cyan-700 shadow-sm dark:text-cyan-300',
      idle: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-700/80 hover:bg-cyan-500/12 dark:text-cyan-300/80',
      count: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-200',
    },
    blue: {
      active: 'border-blue-500/35 bg-blue-500/15 text-blue-700 shadow-sm dark:text-blue-300',
      idle: 'border-blue-500/20 bg-blue-500/5 text-blue-700/80 hover:bg-blue-500/12 dark:text-blue-300/80',
      count: 'bg-blue-500/15 text-blue-700 dark:text-blue-200',
    },
    indigo: {
      active: 'border-indigo-500/35 bg-indigo-500/15 text-indigo-700 shadow-sm dark:text-indigo-300',
      idle: 'border-indigo-500/20 bg-indigo-500/5 text-indigo-700/80 hover:bg-indigo-500/12 dark:text-indigo-300/80',
      count: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-200',
    },
    violet: {
      active: 'border-violet-500/35 bg-violet-500/15 text-violet-700 shadow-sm dark:text-violet-300',
      idle: 'border-violet-500/20 bg-violet-500/5 text-violet-700/80 hover:bg-violet-500/12 dark:text-violet-300/80',
      count: 'bg-violet-500/15 text-violet-700 dark:text-violet-200',
    },
    purple: {
      active: 'border-purple-500/35 bg-purple-500/15 text-purple-700 shadow-sm dark:text-purple-300',
      idle: 'border-purple-500/20 bg-purple-500/5 text-purple-700/80 hover:bg-purple-500/12 dark:text-purple-300/80',
      count: 'bg-purple-500/15 text-purple-700 dark:text-purple-200',
    },
    fuchsia: {
      active: 'border-fuchsia-500/35 bg-fuchsia-500/15 text-fuchsia-700 shadow-sm dark:text-fuchsia-300',
      idle: 'border-fuchsia-500/20 bg-fuchsia-500/5 text-fuchsia-700/80 hover:bg-fuchsia-500/12 dark:text-fuchsia-300/80',
      count: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-200',
    },
    pink: {
      active: 'border-pink-500/35 bg-pink-500/15 text-pink-700 shadow-sm dark:text-pink-300',
      idle: 'border-pink-500/20 bg-pink-500/5 text-pink-700/80 hover:bg-pink-500/12 dark:text-pink-300/80',
      count: 'bg-pink-500/15 text-pink-700 dark:text-pink-200',
    },
    rose: {
      active: 'border-rose-500/35 bg-rose-500/15 text-rose-700 shadow-sm dark:text-rose-300',
      idle: 'border-rose-500/20 bg-rose-500/5 text-rose-700/80 hover:bg-rose-500/12 dark:text-rose-300/80',
      count: 'bg-rose-500/15 text-rose-700 dark:text-rose-200',
    },
  };

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
            const color = chip.color ?? 'gray';
            const styles = chipColorStyles[color];
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => onChipToggle?.(chip.value)}
                className={cn(
                  'inline-flex min-w-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  active ? styles.active : styles.idle,
                )}
              >
                {chip.icon}
                <span className="truncate">{chip.label}</span>
                {chip.count != null ? (
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] leading-none', styles.count)}>
                    {chip.count}
                  </span>
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
