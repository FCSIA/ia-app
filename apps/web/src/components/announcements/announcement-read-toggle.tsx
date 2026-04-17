'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { announcementsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';

type AnnouncementReadToggleProps = {
  announcementId: string;
  isRead: boolean;
  size?: 'sm' | 'default';
  variant?: 'outline' | 'ghost' | 'secondary';
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

export function AnnouncementReadToggle({
  announcementId,
  isRead,
  size = 'sm',
  variant = 'outline',
  className,
  onClick,
}: AnnouncementReadToggleProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      isRead ? announcementsApi.markUnread(announcementId) : announcementsApi.markRead(announcementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcement', announcementId] });
    },
  });

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      disabled={mutation.isPending}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        mutation.mutate();
      }}
    >
      {mutation.isPending ? 'Saving…' : isRead ? 'Mark unread' : 'Mark read'}
    </Button>
  );
}
