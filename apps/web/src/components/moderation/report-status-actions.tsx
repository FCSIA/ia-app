'use client';

import type { LucideIcon } from 'lucide-react';
import { Ellipsis } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownContent,
  DropdownMenu,
  DropdownTrigger,
} from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';

export type ReportStatusAction<Status extends string> = {
  label: string;
  status: Status;
  icon: LucideIcon;
};

/**
 * A review item's next step leads as a button; its other transitions sit in a
 * row menu. Shared by the feedback and moderation queues and their dialogs.
 */
export function ReportStatusActions<Status extends string>({
  primary,
  more,
  emphasis,
  disabled,
  menuLabel,
  onRun,
}: {
  primary: ReportStatusAction<Status>;
  more: ReportStatusAction<Status>[];
  /** `secondary` for a decided item, whose next step is reopening it. */
  emphasis: 'primary' | 'secondary';
  disabled: boolean;
  /** Names the item for the menu button, e.g. "feedback from Ada Lovelace". */
  menuLabel: string;
  onRun: (action: ReportStatusAction<Status>) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant={emphasis}
        leadingIcon={primary.icon}
        disabled={disabled}
        onClick={() => onRun(primary)}
      >
        {primary.label}
      </Button>
      {more.length ? (
        <DropdownMenu disabled={disabled}>
          <DropdownTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`More actions for ${menuLabel}`}
              >
                <Ellipsis />
              </Button>
            }
          />
          <DropdownContent align="end">
            {more.map((action, index) => (
              <MenuItem
                key={action.label}
                index={index}
                icon={action.icon}
                label={action.label}
                onSelect={() => onRun(action)}
              />
            ))}
          </DropdownContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
