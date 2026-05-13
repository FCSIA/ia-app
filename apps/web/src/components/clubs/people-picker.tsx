'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Crown, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ClubAvatar } from './club-avatar';
import { ClubDirectoryEntry, ClubUserRef, formatClubRole, fullName } from './types';

export type SelectablePerson = ClubUserRef &
  Partial<Pick<ClubDirectoryEntry, 'kind' | 'clubRole'>>;

type PeoplePickerProps = {
  people: SelectablePerson[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  emptyText?: string;
  disabled?: boolean;
};

export function PeoplePicker({
  people,
  selectedIds,
  onChange,
  placeholder,
  emptyText = 'No matching people.',
  disabled,
}: PeoplePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const selected = useMemo(
    () => selectedIds.map((id) => people.find((person) => person.id === id)).filter(Boolean) as SelectablePerson[],
    [people, selectedIds],
  );

  const filtered = useMemo(() => {
    const search = deferredQuery.trim().toLowerCase();
    if (!search) return people;

    return people.filter((person) => {
      const tokens = [
        person.firstName,
        person.lastName,
        fullName(person),
        person.uniqueId,
        person.kind,
        person.clubRole,
      ];

      return tokens.some((token) => token?.toLowerCase().includes(search));
    });
  }, [deferredQuery, people]);

  const togglePerson = (personId: string) => {
    if (selectedIds.includes(personId)) {
      onChange(selectedIds.filter((id) => id !== personId));
      return;
    }

    onChange([...selectedIds, personId]);
  };

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="tertiary"
            type="button"
            disabled={disabled}
            className="h-auto min-h-11 w-full justify-between rounded-2xl border-border/70 bg-background/80 px-4 py-3 text-left shadow-sm backdrop-blur"
          >
            <span className="truncate text-sm text-foreground/80">
              {selected.length > 0
                ? `${selected.length} selected`
                : placeholder}
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] rounded-2xl border-border/70 p-0">
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search by name or Student / Staff ID"
            />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup className="p-2">
                {filtered.map((person) => {
                  const isSelected = selectedIds.includes(person.id);

                  return (
                    <CommandItem
                      key={person.id}
                      value={`${fullName(person)} ${person.uniqueId ?? ''}`}
                      onSelect={() => togglePerson(person.id)}
                      className="rounded-xl px-3 py-2"
                    >
                      <ClubAvatar person={person} className="size-9" fallbackClassName="text-[11px]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-foreground">{fullName(person)}</span>
                          {person.clubRole ? (
                            <Badge variant="solid" className="rounded-full bg-amber-500/12 text-[10px] text-amber-700 dark:text-amber-300">
                              <Crown className="mr-1 size-3" />
                              {formatClubRole(person.clubRole)}
                            </Badge>
                          ) : null}
                          {person.kind === 'SPONSOR' && (
                            <Badge variant="solid" className="rounded-full bg-sky-500/12 text-[10px] text-sky-700 dark:text-sky-300">
                              Sponsor
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {person.uniqueId ? <span className="font-mono">{person.uniqueId}</span> : null}
                          {person.clubRole ? <span>{formatClubRole(person.clubRole)}</span> : null}
                        </div>
                      </div>
                      <Check className={cn('ml-2 size-4 text-orange-600 transition-opacity', isSelected ? 'opacity-100' : 'opacity-0')} />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((person) => (
            <Badge
              key={person.id}
              variant="solid"
              className="h-auto rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-[11px] text-orange-900 dark:text-orange-100"
            >
              <span>{fullName(person)}</span>
              {person.uniqueId ? <span className="ml-1 font-mono opacity-75">{person.uniqueId}</span> : null}
              <button
                type="button"
                onClick={() => togglePerson(person.id)}
                className="ml-2 rounded-full text-orange-700/80 transition hover:text-orange-900 dark:text-orange-200 dark:hover:text-white"
                aria-label={`Remove ${fullName(person)}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
