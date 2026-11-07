'use client';

import Image from 'next/image';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { SCHOOL_GIFS, type SchoolGif } from '~/apps/shared/chat/school-gifs';

export function SchoolGifPicker({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (gif: SchoolGif) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor className="absolute bottom-0 left-0 size-px" />
      <PopoverContent
        side="top"
        align="start"
        className="w-96 max-w-[calc(100vw-2rem)] p-2"
        aria-label="Choose a GIF"
      >
        <Command surface="inherit">
          <CommandInput
            placeholder="Search GIFs…"
            aria-label="Search school GIFs"
          />
          <CommandList>
            <CommandEmpty>
              No GIFs found. Try “study” or “celebrate”.
            </CommandEmpty>
            <CommandGroup className="[&_[cmdk-group-items]]:grid [&_[cmdk-group-items]]:grid-cols-3 [&_[cmdk-group-items]]:gap-1">
              {SCHOOL_GIFS.map((gif) => (
                <CommandItem
                  key={gif.id}
                  value={gif.id}
                  keywords={[gif.label, gif.category, ...gif.keywords]}
                  title={gif.label}
                  aria-label={gif.label}
                  className="aspect-video overflow-hidden p-0"
                  onSelect={() => onSelect(gif)}
                >
                  <Image
                    src={gif.poster}
                    alt=""
                    width={160}
                    height={90}
                    unoptimized
                    className="size-full object-cover"
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
