'use client';

import { useState, type ComponentType, type ReactNode } from 'react';
// flushSync is deliberate: closing the sheet synchronously removes its focus
// trap before an action focuses the composer, which must happen inside the tap
// for iOS to raise the keyboard. Nothing here uses View Transitions.
import { flushSync } from 'react-dom';
import { Pencil } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Toggle } from '@/components/ui/toggle';
import { hapticTick } from '@/lib/haptics';
import { cn } from '@/lib/utils';

export type MessageSheetAction = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

export type MessageSheetReaction = {
  value: string;
  label: string;
  name: string;
  selected: boolean;
};

/**
 * The touch counterpart of a message's context menu: a bottom sheet that names
 * the message, puts reactions one tap away, and groups the actions with
 * full-width targets. The line under the reactions names the double-tap
 * reaction; tapping it turns the reaction row into a picker for it.
 */
export function MessageActionSheet({
  open,
  onOpenChange,
  preview,
  reactions,
  doubleTap,
  onReact,
  actionGroups,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: {
    avatar: ReactNode;
    authorName: string;
    sentAt: string;
    text: string;
  };
  reactions: MessageSheetReaction[];
  /** The reaction a double tap adds, and how to change it. */
  doubleTap?: { value: string; onChange: (value: string) => void };
  onReact?: (value: string) => void;
  actionGroups: MessageSheetAction[][];
}) {
  const groups = actionGroups.filter((group) => group.length > 0);
  const [choosingDoubleTap, setChoosingDoubleTap] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  // Each opening starts back on the ordinary reaction row.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setChoosingDoubleTap(false);
  }
  const doubleTapReaction = doubleTap
    ? reactions.find((reaction) => reaction.value === doubleTap.value)
    : undefined;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent
        className="select-none [-webkit-touch-callout:none]"
        // Focus stays where the chosen action puts it, such as the composer,
        // instead of returning to whatever had it before the sheet opened.
        onCloseAutoFocus={(event) => event.preventDefault()}
        // The sheet itself takes focus, not its first reaction, which also
        // dismisses the keyboard if the composer had it.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.target as HTMLElement).focus({ preventScroll: true });
        }}
      >
        <DrawerTitle className="sr-only">Message from {preview.authorName}</DrawerTitle>
        <DrawerDescription className="sr-only">
          React to this message or choose an action.
        </DrawerDescription>
        <div className="min-h-0 overflow-y-auto overscroll-contain pb-3">
          <div className="flex items-start gap-3 px-4 pb-3 pt-3">
            <div className="shrink-0">{preview.avatar}</div>
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-sm font-semibold text-foreground">
                  {preview.authorName}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{preview.sentAt}</span>
              </p>
              {preview.text ? (
                <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">
                  {preview.text}
                </p>
              ) : null}
            </div>
          </div>

          {onReact && reactions.length > 0 ? (
            <div className="px-3">
              <div
                role="group"
                aria-label="Reactions"
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${reactions.length}, minmax(0, 1fr))` }}
              >
                {reactions.map((reaction) => (
                  <Toggle
                    key={reaction.value}
                    // While choosing, "on" marks the double-tap reaction
                    // instead of your reactions to this message.
                    pressed={
                      choosingDoubleTap ? reaction.value === doubleTap?.value : reaction.selected
                    }
                    aria-label={choosingDoubleTap ? `Double-tap with ${reaction.name}` : reaction.name}
                    className={cn(
                      'aspect-square h-auto w-full min-w-0 max-w-12 justify-self-center rounded-full bg-muted p-0 text-[22px] leading-none transition-[transform,background-color,box-shadow] duration-150 ease-out active:scale-90 focus-visible:ring-2 motion-reduce:transition-none',
                      choosingDoubleTap
                        ? 'data-[state=on]:bg-primary/20 data-[state=on]:ring-2 data-[state=on]:ring-primary'
                        : 'data-[state=on]:bg-primary/15 data-[state=on]:ring-1 data-[state=on]:ring-primary/40',
                    )}
                    onPressedChange={() => {
                      if (choosingDoubleTap && doubleTap) {
                        hapticTick();
                        doubleTap.onChange(reaction.value);
                        setChoosingDoubleTap(false);
                        return;
                      }
                      flushSync(() => onOpenChange(false));
                      onReact(reaction.value);
                    }}
                  >
                    <span aria-hidden="true">{reaction.label}</span>
                  </Toggle>
                ))}
              </div>
              {doubleTapReaction ? (
                <p
                  aria-live="polite"
                  className="mt-2 flex min-h-6 items-center justify-center gap-1 text-[11px] text-muted-foreground"
                >
                  {choosingDoubleTap ? (
                    <>
                      Pick what a double tap adds
                      <button
                        type="button"
                        className="rounded-full px-1.5 py-0.5 font-medium text-primary outline-none active:opacity-60 focus-visible:ring-1 focus-visible:ring-ring"
                        onClick={() => setChoosingDoubleTap(false)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      Double-tap a message to add
                      <button
                        type="button"
                        aria-label={`Change double-tap reaction, now ${doubleTapReaction.name}`}
                        // Small to look at; the invisible ::after makes it a
                        // finger-sized target.
                        className="relative inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 outline-none transition-transform duration-150 after:absolute after:-inset-x-2 after:-inset-y-2 active:scale-90 focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none"
                        onClick={() => setChoosingDoubleTap(true)}
                      >
                        <span
                          key={doubleTapReaction.value}
                          aria-hidden="true"
                          className="text-[13px] leading-none motion-safe:animate-in motion-safe:zoom-in-50"
                        >
                          {doubleTapReaction.label}
                        </span>
                        <Pencil aria-hidden="true" className="size-2.5" />
                      </button>
                    </>
                  )}
                </p>
              ) : null}
            </div>
          ) : null}

          {groups.map((group) => (
            <div
              key={group.map((action) => action.key).join(':')}
              className="mx-3 mt-3 divide-y divide-border/60 overflow-hidden rounded-xl bg-muted/60"
            >
              {group.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.key}
                    type="button"
                    disabled={action.disabled}
                    className={cn(
                      'flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px] text-foreground outline-none transition-colors duration-100 active:bg-active focus-visible:bg-hover disabled:opacity-50',
                      action.destructive && 'text-destructive',
                    )}
                    onClick={() => {
                      // Closed first, and synchronously: the sheet's focus trap
                      // must be gone before an action focuses the composer.
                      flushSync(() => onOpenChange(false));
                      action.onSelect();
                    }}
                  >
                    <Icon
                      className={cn(
                        'size-5 shrink-0',
                        action.destructive ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    />
                    {action.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
