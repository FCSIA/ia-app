'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { Check, UserPlus, X } from 'lucide-react';
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
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ClubAvatar } from './club-avatar';
import { ClubDirectoryEntry, ClubUserRef, fullName } from './types';

export type SelectablePerson = ClubUserRef &
  Partial<Pick<ClubDirectoryEntry, 'kind' | 'clubRole' | 'customRoleName' | 'roleName'>>;

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
    () => selectedIds.map((id) => people.find((person) => person._id === id)).filter(Boolean) as SelectablePerson[],
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
        person.roleName,
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
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="tertiary"
            size="sm"
            type="button"
            disabled={disabled}
            active={open}
            leadingIcon={UserPlus}
            className="w-fit"
          >
            <span className="truncate">{placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search by name or unique ID"
            />
            <CommandList className="max-h-72">
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {filtered.map((person) => {
                  const isSelected = selectedIds.includes(person._id);

                  return (
                    <CommandItem
                      key={person._id}
                      value={`${fullName(person)} ${person.uniqueId ?? ''}`}
                      onSelect={() => togglePerson(person._id)}
                      className="min-h-11"
                    >
                      <ClubAvatar person={person} className="size-8" fallbackClassName="text-[10px]" />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{fullName(person)}</span>
                        {person.roleName ? <span className="block truncate text-xs text-muted-foreground">{person.roleName}</span> : null}
                      </div>
                      <Check className={cn('text-foreground transition-opacity', isSelected ? 'opacity-100' : 'opacity-0')} />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" aria-label="Selected people">
          {selected.map((person) => (
            <Tooltip key={person._id} content={`Remove ${fullName(person)}`}>
              <Button
                type="button"
                variant="tertiary"
                size="sm"
                onClick={() => togglePerson(person._id)}
                aria-label={`Remove ${fullName(person)}`}
              >
                {fullName(person)}
                <X />
              </Button>
            </Tooltip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
