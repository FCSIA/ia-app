'use client';

import { useState } from 'react';
import { useMutation } from '@/lib/convex-react';
import { Mail, MailOpen } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { Button } from '@/components/ui/button';
import type { ButtonProps } from '@/components/ui/button';

type AnnouncementReadToggleProps = {
  announcementId: string;
  isRead: boolean;
  iconOnly?: boolean;
  size?: ButtonProps['size'];
  variant?: 'tertiary' | 'ghost' | 'secondary';
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

export function AnnouncementReadToggle({
  announcementId,
  isRead,
  iconOnly = false,
  size,
  variant = 'tertiary',
  className,
  onClick,
}: AnnouncementReadToggleProps) {
  const markRead = useMutation(api.announcements.engagement.markRead);
  const markUnread = useMutation(api.announcements.engagement.markUnread);
  const [pending, setPending] = useState(false);
  const label = isRead ? 'Mark unread' : 'Mark read';
  const ReadStateIcon = isRead ? Mail : MailOpen;

  return (
    <Button
      type="button"
      size={size ?? (iconOnly ? 'icon-sm' : 'sm')}
      variant={variant}
      className={className}
      loading={pending}
      aria-label={iconOnly ? label : undefined}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        setPending(true);
        const action = isRead ? markUnread : markRead;
        void action({ announcementId: announcementId as Id<'announcements'> })
          .catch(() => undefined)
          .finally(() => setPending(false));
      }}
    >
      {iconOnly ? <ReadStateIcon /> : label}
    </Button>
  );
}
