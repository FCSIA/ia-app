"use client";

import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { SCHOOL_GIFS, type SchoolGif } from "~/apps/shared/chat/school-gifs";

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" mobilePosition="top">
        <DialogHeader>
          <DialogTitle>Choose a GIF</DialogTitle>
          <DialogDescription>
            Reaction GIFs from Tenor, selected for school. Choose one to add to
            your message.
          </DialogDescription>
        </DialogHeader>
        <Command surface="inherit">
          <CommandInput
            placeholder="Search GIFs…"
            aria-label="Search school GIFs"
          />
          <CommandList>
            <CommandEmpty>
              No GIFs found. Try “study” or “celebrate”.
            </CommandEmpty>
            <CommandGroup heading="Reactions">
              {SCHOOL_GIFS.map((gif) => (
                <CommandItem
                  key={gif.id}
                  value={gif.id}
                  keywords={[gif.label, gif.category, ...gif.keywords]}
                  onSelect={() => onSelect(gif)}
                >
                  <Image
                    src={gif.poster}
                    alt=""
                    width={80}
                    height={60}
                    unoptimized
                    className="shrink-0"
                  />
                  <span>{gif.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {gif.category}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
