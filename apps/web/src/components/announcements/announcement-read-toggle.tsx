'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { Button } from '@/components/ui/button';

type AnnouncementReadToggleProps = {
  announcementId: string;
  isRead: boolean;
  size?: 'sm' | 'md';
  variant?: 'tertiary' | 'ghost' | 'secondary';
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

export function AnnouncementReadToggle({
  announcementId,
  isRead,
  size = 'sm',
  variant = 'tertiary',
  className,
  onClick,
}: AnnouncementReadToggleProps) {
  const markRead = useMutation(api.announcements.engagement.markRead);
  const markUnread = useMutation(api.announcements.engagement.markUnread);
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      disabled={pending}
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
      {pending ? 'Saving…' : isRead ? 'Mark unread' : 'Mark read'}
    </Button>
  );
}
