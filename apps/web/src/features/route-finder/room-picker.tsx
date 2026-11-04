"use client";

// One searchable list of every room in the building. Typing is forgiving
// (see room-search): case, the word "room", and small typos don't matter.

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Floor } from "./building-data";
import { labelFor } from "./router";
import { searchRooms } from "./room-search";

export type RoomChoice = { room: string; floor: Floor };

type RoomPickerProps = {
  id?: string;
  value: RoomChoice | null;
  onChange: (value: RoomChoice) => void;
  placeholder: string;
};

const itemValue = (choice: RoomChoice) => `${choice.floor}:${choice.room}`;

export function RoomPicker({ id, value, onChange, placeholder }: RoomPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("");

  const matches = searchRooms(query);

  // Filtering happens here, so keep the highlight on the best match: Enter
  // then picks what the student typed.
  const handleQueryChange = (nextQuery: string) => {
    setQuery(nextQuery);
    const [best] = searchRooms(nextQuery);
    setActive(best ? itemValue(best) : "");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    setQuery("");
    const [first] = searchRooms("");
    setActive(nextOpen && value ? itemValue(value) : first ? itemValue(first) : "");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="tertiary"
          type="button"
          trailingIcon={ChevronsUpDown}
          className="h-auto min-h-11 w-full justify-between rounded-2xl border-border/70 bg-background/80 px-4 py-3 text-left shadow-sm"
        >
          <span className="flex min-w-0 flex-1 items-baseline gap-2 text-sm">
            {value ? (
              <>
                <span className="truncate font-medium text-foreground">{labelFor(value.room, value.floor)}</span>
                <span className="shrink-0 text-muted-foreground">Floor {value.floor}</span>
              </>
            ) : (
              <span className="truncate text-muted-foreground">{placeholder}</span>
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl p-0"
      >
        <Command shouldFilter={false} value={active} onValueChange={setActive}>
          <CommandInput value={query} onValueChange={handleQueryChange} placeholder="Type a room number or name" />
          <CommandList className="max-h-[22rem] p-1">
            <CommandEmpty>No rooms match &ldquo;{query.trim()}&rdquo;.</CommandEmpty>
            {matches.map((choice) => {
              const selected = !!value && itemValue(value) === itemValue(choice);
              return (
                <CommandItem
                  key={itemValue(choice)}
                  value={itemValue(choice)}
                  onSelect={() => {
                    onChange(choice);
                    handleOpenChange(false);
                  }}
                  className="min-h-11 rounded-xl px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {labelFor(choice.room, choice.floor)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">Floor {choice.floor}</span>
                  <Check
                    aria-hidden
                    className={cn(
                      "ml-1 size-4 shrink-0 text-primary transition-opacity",
                      selected ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
