'use client';

import { MoreHorizontal, Trash2 } from 'lucide-react';
import { ClubPersonAvatar } from '@/components/clubs/club-person-avatar';
import type { UserProfilePerson } from '@/components/clubs/user-profile-dialog';
import { PersonTrigger } from '@/components/users/person-trigger';
import { Button } from '@/components/ui/button';
import { DeveloperBadge } from '@/components/ui/developer-badge';
import {
  DropdownContent,
  DropdownMenu,
  DropdownTrigger,
} from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import {
  Message,
  MessageActions,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from '@/components/ui/message';
import { Tooltip } from '@/components/ui/tooltip';
import { formatMessageTime } from '@/lib/message-time';
import { displayName } from '~/apps/shared/user-name';
import type { AnnouncementAuthorPerson } from './announcement-author';

/** Announcement discussion uses the same author gutter and metadata as chat. */
export function AnnouncementComment({
  author,
  body,
  createdAt,
  canDelete,
  deleting,
  onDelete,
}: {
  author?: AnnouncementAuthorPerson | null;
  body: string;
  createdAt: number | string;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const name = displayName(author) || 'Unknown author';
  const person = author?._id
    ? {
        ...author,
        _id: author._id as UserProfilePerson['_id'],
        firstName: author.firstName ?? '',
        lastName: author.lastName ?? '',
        preferredName: author.preferredName ?? undefined,
        avatarUrl: author.avatarUrl ?? null,
      }
    : null;
  return (
    <Message>
      <MessageAvatar>
        {person ? (
          <PersonTrigger
            person={person}
            trigger={
              <button
                type="button"
                aria-label={`View ${name}'s profile`}
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ClubPersonAvatar person={person} className="size-9" />
              </button>
            }
          />
        ) : null}
      </MessageAvatar>
      <MessageContent className="gap-1">
        <MessageHeader className="flex-wrap gap-x-2 gap-y-0 px-0">
          {person ? (
            <PersonTrigger
              person={person}
              trigger={
                <button
                  type="button"
                  className="max-w-full truncate text-sm font-semibold text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`View ${name}'s profile`}
                >
                  {name}
                </button>
              }
            />
          ) : (
            <span className="font-semibold text-foreground">{name}</span>
          )}
          <DeveloperBadge user={author} size={12} />
          <Tooltip content={formatMessageTime(createdAt, 'full')}>
            <time dateTime={new Date(createdAt).toISOString()}>
              {formatMessageTime(createdAt)}
            </time>
          </Tooltip>
        </MessageHeader>
        <p className="typeset typeset-chat max-w-[75ch] whitespace-pre-wrap break-words text-foreground">
          {body}
        </p>
      </MessageContent>
      {canDelete ? (
        <MessageActions className="opacity-0 group-hover/message:opacity-100 group-focus-within/message:opacity-100 pointer-coarse:opacity-100">
          <DropdownMenu>
            <DropdownTrigger
              render={
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  aria-label="Comment actions"
                  loading={deleting}
                >
                  <MoreHorizontal />
                </Button>
              }
            />
            <DropdownContent align="end">
              <MenuItem
                index={0}
                icon={Trash2}
                label="Delete comment"
                className="text-destructive"
                disabled={deleting}
                onSelect={onDelete}
              />
            </DropdownContent>
          </DropdownMenu>
        </MessageActions>
      ) : null}
    </Message>
  );
}
