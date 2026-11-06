'use client';

import {
  ArrowLeft,
  FileText,
  Link2,
  MessageSquare,
  PencilRuler,
  Pin,
  Play,
} from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import type { ChannelVisibility } from '~/apps/shared/chat/protocol';
import { formatWebAttachmentListSize } from '~/apps/shared/chat/attachments';

import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { ClubChannelVisibilityIcon } from '@/components/clubs/channel-visibility';
import { ClubPersonAvatar } from '@/components/clubs/club-person-avatar';
import { PersonRow } from '@/components/users/person-row';
import { fullName } from '@/components/clubs/types';
import { ChannelNotificationSettings } from '@/components/notifications/channel-notification-settings';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardGroup,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TabsSubtle,
  TabsSubtleItem,
  TabsSubtlePanel,
} from '@/components/ui/tabs-subtle';
import { useQuery } from '@/lib/convex-react';
import { formatMessageTime } from '@/lib/message-time';
import type { ClubChannelMessage } from '@/components/clubs/types';

const DETAIL_TABS = ['Members', 'Pins', 'Media', 'Files', 'Links'] as const;

type ChannelDetailsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: Id<'clubs'>;
  channelId: Id<'clubChannels'>;
  channel: {
    name: string;
    description?: string | null;
    visibility: ChannelVisibility;
  };
  pinnedMessages: ClubChannelMessage[];
  pinnedHasMore?: boolean;
  /** Jumps the conversation to a message; the sheet closes first. */
  onJump: (messageId: string, threadId?: string) => void;
  /** Present when the club allows whiteboards in this channel. */
  whiteboard?: { showing: boolean; onToggle: () => void };
};

/**
 * Everything about a channel that isn't the conversation: who is in it and
 * what has been pinned or shared. Phones open it from the channel title, so
 * the header keeps one control for it instead of a row of icons.
 */
export function ChannelDetailsSheet({
  open,
  onOpenChange,
  clubId,
  channelId,
  channel,
  pinnedMessages,
  pinnedHasMore = false,
  onJump,
  whiteboard,
}: ChannelDetailsSheetProps) {
  const members = useQuery(
    api.clubs.channels.getMentionContext,
    open ? { clubId, channelId } : 'skip',
  )?.members;
  const library = useQuery(
    api.clubs.channels.getChannelLibrary,
    open ? { clubId, channelId } : 'skip',
  );
  const tabsId = useId();
  const [tab, setTab] = useState(0);
  const jump = (messageId: string, threadId?: string) => {
    onOpenChange(false);
    onJump(messageId, threadId);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] max-h-none overflow-hidden">
        {/* One header row: back, the channel it describes, and its two
            actions. The description hangs directly under the title. */}
        <div className="flex items-start gap-1 px-2 pt-1">
          <DrawerClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Back to conversation">
              <ArrowLeft />
            </Button>
          </DrawerClose>
          <div className="min-w-0 flex-1 py-1.5">
            <DrawerTitle className="flex min-w-0 items-center gap-1 text-[15px] font-semibold leading-5 tracking-normal text-foreground [&_svg]:size-[1em] [&_svg]:shrink-0">
              <ClubChannelVisibilityIcon
                visibility={channel.visibility}
                className="text-muted-foreground"
              />
              <span className="truncate">{channel.name}</span>
            </DrawerTitle>
            <DrawerDescription className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
              {channel.description ||
                (members
                  ? `${members.length} ${members.length === 1 ? 'member' : 'members'}`
                  : 'Channel details')}
            </DrawerDescription>
          </div>
          {whiteboard ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={whiteboard.showing ? 'Show chat' : 'Show whiteboards'}
              onClick={() => {
                onOpenChange(false);
                whiteboard.onToggle();
              }}
            >
              {whiteboard.showing ? <MessageSquare /> : <PencilRuler />}
            </Button>
          ) : null}
          <ChannelNotificationSettings
            clubId={clubId}
            channelId={channelId}
            channelName={channel.name}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {/* Five views can outgrow a narrow phone or large text sizes: the
              row scrolls sideways instead of widening the sheet. */}
          <div className="shrink-0 overflow-x-auto px-3 pb-1 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsSubtle
              size="compact"
              idPrefix={tabsId}
              selectedIndex={tab}
              onSelect={setTab}
              aria-label="Channel details"
            >
              {DETAIL_TABS.map((label, index) => (
                <TabsSubtleItem key={label} index={index} label={label} />
              ))}
            </TabsSubtle>
          </div>

          {/* The sheet drags from its handle and header; the list only scrolls,
              so a long member list never fights the dismiss gesture. */}
          <div
            data-vaul-no-drag
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
          >
            <TabsSubtlePanel index={0} selectedIndex={tab} idPrefix={tabsId}>
              {members === undefined ? (
                <ListSkeleton />
              ) : (
                <section aria-label={`Members — ${members.length}`}>
                  <h3 className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                    Members — {members.length}
                  </h3>
                  {/* The roster composition Club Overview uses: tapping a
                      person opens their profile preview. */}
                  <CardGroup orientation="inline" separated className="gap-0">
                    {members.map((member, index) => (
                      <PersonRow
                        key={member._id}
                        person={member}
                        roleName={
                          member.clubRole && member.clubRole !== 'Member'
                            ? member.clubRole
                            : undefined
                        }
                        showRole
                        index={index}
                      />
                    ))}
                  </CardGroup>
                </section>
              )}
            </TabsSubtlePanel>

            <TabsSubtlePanel index={1} selectedIndex={tab} idPrefix={tabsId}>
              {pinnedMessages.length === 0 ? (
                <Empty icon={<Pin />}>No pinned messages yet.</Empty>
              ) : (
                <List
                  label={`Pinned — ${pinnedMessages.length}${pinnedHasMore ? '+' : ''}`}
                >
                  {pinnedMessages.map((message, index) => (
                    <Card
                      key={message._id}
                      index={index}
                      label={`Jump to pinned message by ${fullName(message.author)}`}
                      onClick={() => jump(message._id)}
                    >
                      <ClubPersonAvatar
                        person={message.author}
                        className="size-9 self-start"
                      />
                      <CardHeader>
                        <CardDescription>
                          {fullName(message.author)} ·{' '}
                          {formatMessageTime(message.createdAt)}
                        </CardDescription>
                        <CardTitle className="line-clamp-2 font-normal">
                          {message.poll?.question ||
                            message.body ||
                            message.attachments[0]?.fileName ||
                            'Attachment'}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  ))}
                </List>
              )}
            </TabsSubtlePanel>

            <TabsSubtlePanel index={2} selectedIndex={tab} idPrefix={tabsId}>
              {library === undefined ? (
                <div className="grid grid-cols-3 gap-1">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <Skeleton key={index} className="aspect-square" />
                  ))}
                </div>
              ) : library.media.length === 0 ? (
                <Empty icon={<Play />}>
                  No photos or videos shared recently.
                </Empty>
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {library.media.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      aria-label={`Jump to ${item.fileName}`}
                      className="relative aspect-square overflow-hidden rounded-md bg-muted transition-opacity duration-150 active:opacity-60 active:duration-0"
                      onClick={() => jump(item.messageId, item.threadRootId)}
                    >
                      {item.mimeType?.startsWith('video/') ? (
                        <span className="flex size-full items-center justify-center text-muted-foreground">
                          <Play className="size-6" />
                        </span>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.fileUrl}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </TabsSubtlePanel>

            <TabsSubtlePanel index={3} selectedIndex={tab} idPrefix={tabsId}>
              {library === undefined ? (
                <ListSkeleton />
              ) : library.files.length === 0 ? (
                <Empty icon={<FileText />}>No files shared recently.</Empty>
              ) : (
                <List>
                  {library.files.map((item, index) => (
                    <Card
                      key={item._id}
                      index={index}
                      label={`Jump to ${item.fileName}`}
                      onClick={() => jump(item.messageId, item.threadRootId)}
                    >
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <CardHeader>
                        <CardTitle className="min-w-0 truncate">
                          {item.fileName}
                        </CardTitle>
                        <CardDescription>
                          {[formatWebAttachmentListSize(item.size), formatMessageTime(item.createdAt)]
                            .filter(Boolean)
                            .join(' · ')}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </List>
              )}
            </TabsSubtlePanel>

            <TabsSubtlePanel index={4} selectedIndex={tab} idPrefix={tabsId}>
              {library === undefined ? (
                <ListSkeleton />
              ) : library.links.length === 0 ? (
                <Empty icon={<Link2 />}>No links shared recently.</Empty>
              ) : (
                <List>
                  {library.links.map((link, index) => (
                    <Card
                      key={`${link.messageId}:${link.url}`}
                      index={index}
                      href={link.url}
                      external
                      label={`Open ${hostname(link.url)}`}
                    >
                      <Link2 className="size-4 shrink-0 text-muted-foreground" />
                      <CardHeader>
                        <CardTitle className="min-w-0 truncate">
                          {hostname(link.url)}
                        </CardTitle>
                        <CardDescription className="truncate">
                          {link.url}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </List>
              )}
            </TabsSubtlePanel>

            {library && !library.scannedAll ? (
              <p className="pt-3 text-center text-xs text-muted-foreground">
                Showing what was shared in the latest messages.
              </p>
            ) : null}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** One record list: the shared inline CardGroup owns rows, dividers, and
 * corners, as on Club People; the sheet adds no frame of its own. */
function List({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section>
      {label ? (
        <h3 className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">
          {label}
        </h3>
      ) : null}
      <CardGroup orientation="inline" corners="compact">
        {children}
      </CardGroup>
    </section>
  );
}

function Empty({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground [&_svg]:size-6">
      {icon}
      <p>{children}</p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
