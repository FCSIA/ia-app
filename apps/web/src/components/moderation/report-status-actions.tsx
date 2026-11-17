'use client';

import type { LucideIcon } from 'lucide-react';
import { DataTableControls } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';

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
    <DataTableControls aria-label={`Actions for ${menuLabel}`}>
      <Button
        size="compact"
        variant={emphasis}
        leadingIcon={primary.icon}
        disabled={disabled}
        onClick={() => onRun(primary)}
      >
        {primary.label}
      </Button>
      {more.map((action) => (
        <Button key={action.status} size="compact" variant="ghost" leadingIcon={action.icon} disabled={disabled} onClick={() => onRun(action)}>
          {action.label}
        </Button>
      ))}
    </DataTableControls>
  );
}
