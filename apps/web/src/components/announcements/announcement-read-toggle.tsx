'use client';

import { useToast } from '@/hooks/use-toast';
import { forwardRef, useState } from 'react';
import { useMutation } from '@/lib/convex-react';
import { Mail, MailOpen } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { Button } from '@/components/ui/button';
import type { ButtonProps } from '@/components/ui/button';

type AnnouncementReadToggleProps = Omit<ButtonProps, 'size' | 'variant'> & {
  announcementId: string;
  isRead: boolean;
  iconOnly?: boolean;
  size?: ButtonProps['size'];
  variant?: 'tertiary' | 'ghost' | 'secondary';
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

export const AnnouncementReadToggle = forwardRef<HTMLButtonElement, AnnouncementReadToggleProps>(function AnnouncementReadToggle({
  announcementId,
  isRead,
  iconOnly = false,
  size,
  variant = 'tertiary',
  className,
  onClick,
  ...buttonProps
}, ref) {
  const markRead = useMutation(api.announcements.engagement.markRead);
  const markUnread = useMutation(api.announcements.engagement.markUnread);
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const label = isRead ? 'Mark unread' : 'Mark read';
  const ReadStateIcon = isRead ? Mail : MailOpen;

  return (
    <Button
      {...buttonProps}
      ref={ref}
      type="button"
      size={size ?? (iconOnly ? 'icon-sm' : 'sm')}
      variant={variant}
      className={className}
      loading={pending}
      aria-label={iconOnly ? label : undefined}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || pending) return;
        setPending(true);
        const action = isRead ? markUnread : markRead;
        void action({ announcementId: announcementId as Id<'announcements'> })
          .catch(() => toast({ title: 'Could not update read status', variant: 'destructive' }))
          .finally(() => setPending(false));
      }}
    >
      {iconOnly ? <ReadStateIcon /> : label}
    </Button>
  );
});
