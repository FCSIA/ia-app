'use client';

import { hasAnyRole, isSuperAdmin, MODERATION_ALERT_ROLES } from '~/apps/shared/roles';
import { isMuteActive } from '~/apps/shared/notification-mute';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useShape } from '@/lib/shape-context';
import { buildNotificationChannelTree, type NotificationChannelNode } from './notification-channel-tree';
import type { FunctionReturnType } from 'convex/server';
import { PushNotificationSettings } from '@/components/notifications/push-notification-settings';
import { NOTIFICATION_CATEGORY_OPTIONS } from '@/components/notifications/notification-category-options';
import { NotificationScopeSwitch } from '@/components/notifications/notification-scope-switch';
import {
  AtSign,
  BellRing,
  CalendarDays,
  ChevronDown,
  Hash,
  FolderOpen,
  Megaphone,
  MessageSquareText,
  ShieldAlert,
  Presentation,
  RefreshCcw,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useCurrentUser } from '@/lib/auth';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { clubScopeKey, GLOBAL_SCOPE_KEY, type NotificationCategory } from '~/apps/shared/notifications';

const CATEGORY_ICONS: Record<NotificationCategory, LucideIcon> = {
  SCHOOL_ANNOUNCEMENT: Megaphone,
  CLUB_ANNOUNCEMENT: Megaphone,
  CLUB_JOIN_REQUEST: Users,
  CLUB_CHANNEL_MESSAGE: BellRing,
  CLUB_CHANNEL_MENTION: AtSign,
  CLUB_CHANNEL_TAG_MENTION: Hash,
  CLUB_CHANNEL_THREAD: Hash,
  EVENT: CalendarDays,
  FLEX_FRIDAY: Presentation,
  CONTENT_MODERATED: ShieldAlert,
  FEEDBACK: MessageSquareText,
  FRIEND_REQUEST: Users,
  FRIEND_SCHEDULE_CHANGE: RefreshCcw,
  ACCOUNT_SECURITY: ShieldAlert,
};

export function NotificationSettingsPanel() {
  const shape = useShape();
  const user = useCurrentUser();
  const preferences = useQuery(api.notifications.preferences.list);
  const [optimisticGlobalEnabled, setOptimisticGlobalEnabled] = useState<
    Partial<Record<NotificationCategory, boolean>>
  >({});
  const hasAdministrativeClubAccess = isSuperAdmin(user);
  const myClubs = useQuery(
    api.clubs.management.getMyClubs,
    hasAdministrativeClubAccess ? 'skip' : {},
  );
  const canSeeStaffCategories = hasAnyRole(user, MODERATION_ALERT_ROLES);

  const involvedClubs = useMemo(() => {
    const entries = [...(myClubs?.memberOf ?? []), ...(myClubs?.sponsoring ?? [])];
    const seen = new Set<string>();
    return entries.filter((club) => {
      if (seen.has(club._id)) return false;
      seen.add(club._id);
      return true;
    });
  }, [myClubs]);

  const globalSettings = useMemo(
    () =>
      NOTIFICATION_CATEGORY_OPTIONS.filter(
        (category) => !category.staffOnly || canSeeStaffCategories,
      ),
    [canSeeStaffCategories],
  );

  const clubsLoading = myClubs === undefined;

  return (
    <div className="flex w-full min-w-0 max-w-4xl flex-col gap-6">
      <PushNotificationSettings />
      <section className="flex flex-col gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BellRing className="size-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold text-foreground">General notifications</h2>
          </div>
        </div>
        <div className={cn('divide-y divide-border/30 overflow-hidden border border-border/50 bg-card', shape.mergedBg)}>
          {globalSettings.map((setting) => {
            const Icon = CATEGORY_ICONS[setting.key];
            const preference = preferences?.find(
              (entry) => entry.category === setting.key && entry.scopeKey === GLOBAL_SCOPE_KEY,
            );
            const enabled =
              optimisticGlobalEnabled[setting.key] ??
              (preference ? preference.enabled !== false : setting.defaultEnabled);

            return (
              <div
                key={setting.key}
                id={`notification-global-${setting.key}`}
                className="flex min-w-0 items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon
                    className={cn(
                      'size-4 shrink-0',
                      enabled ? 'text-primary' : 'text-muted-foreground',
                    )}
                    aria-hidden
                  />
                  <p className="truncate text-sm font-medium text-foreground">{setting.label}</p>
                </div>
                <NotificationScopeSwitch
                  category={setting.key}
                  label={setting.label}
                  defaultEnabled={setting.defaultEnabled}
                  compact
                  className="shrink-0"
                  onOptimisticChange={(nextEnabled) => {
                    setOptimisticGlobalEnabled((current) => {
                      if (nextEnabled === null) {
                        const next = { ...current };
                        delete next[setting.key];
                        return next;
                      }
                      return { ...current, [setting.key]: nextEnabled };
                    });
                  }}
                />
              </div>
            );
          })}
        </div>
      </section>
      {!hasAdministrativeClubAccess ? (
        <section className="flex flex-col gap-3">
          <div>
            <div className="flex items-center gap-2">
              <AtSign className="size-4 text-primary" aria-hidden />
              <h2 className="text-sm font-semibold text-foreground">Club notifications</h2>
            </div>
          </div>
          {clubsLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : involvedClubs.length > 0 ? (
            <div className="flex flex-col gap-4">
              {involvedClubs.map((club) => (
                <ClubNotificationChannels key={club._id} clubId={club._id} clubName={club.name} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No clubs.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}

type ClubNavigation = NonNullable<FunctionReturnType<typeof api.clubs.detail.getWorkspaceNavigation>>;
type Channel = ClubNavigation['channels'][number];
type Unit = ClubNavigation['units'][number];
type Preferences = FunctionReturnType<typeof api.notifications.preferences.list> | undefined;

function ClubNotificationChannels({ clubId, clubName }: { clubId: Id<'clubs'>; clubName: string }) {
  const shape = useShape();
  const navigation = useQuery(api.clubs.detail.getWorkspaceNavigation, { clubId });
  const preferences = useQuery(api.notifications.preferences.list);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const [optimisticClubEnabled, setOptimisticClubEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const tree = useMemo(
    () => buildNotificationChannelTree(navigation?.units ?? [], navigation?.channels ?? []),
    [navigation],
  );
  const clubPreference = preferences?.find(
    (preference) => preference.category === 'CLUB_ANNOUNCEMENT' && preference.scopeKey === clubScopeKey(clubId),
  ) ?? preferences?.find(
    (preference) => preference.category === 'CLUB_ANNOUNCEMENT' && preference.scopeKey === GLOBAL_SCOPE_KEY,
  );
  const storedClubEnabled = clubPreference?.enabled !== false && clubPreference?.level !== 'OFF';
  const clubEnabled = optimisticClubEnabled ?? storedClubEnabled;

  useEffect(() => {
    if (optimisticClubEnabled !== null && preferences !== undefined && storedClubEnabled === optimisticClubEnabled) {
      setOptimisticClubEnabled(null);
    }
  }, [optimisticClubEnabled, preferences, storedClubEnabled]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={cn('overflow-hidden border border-border/50 bg-card', shape.mergedBg)}>
        <div id={`notification-club-${clubId}`} className="flex min-w-0 items-center gap-2 bg-surface-3/80 px-3 py-2">
          <Megaphone className={cn('size-4 shrink-0', clubEnabled ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold" title={clubName}>{clubName}</h3>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`${open ? 'Collapse' : 'Expand'} ${clubName} notification settings`}
            >
              {navigation ? (
                <span className="tabular-nums">
                  {navigation.channels.length} channel{navigation.channels.length === 1 ? '' : 's'}
                </span>
              ) : null}
              <ChevronDown className={cn('size-3.5 transition-transform motion-reduce:transition-none', open && 'rotate-180')} aria-hidden />
            </Button>
          </CollapsibleTrigger>
          <NotificationScopeSwitch
            category="CLUB_ANNOUNCEMENT"
            label={`${clubName} notifications`}
            clubId={clubId}
            compact
            className="shrink-0"
            onOptimisticChange={setOptimisticClubEnabled}
          />
        </div>
        <p className="px-3 py-2 text-xs text-muted-foreground">
          {clubPreference?.scopeKey === 'global' ? <>Club alerts inherit <a className="underline" href="#notification-global-CLUB_ANNOUNCEMENT">global club announcements</a>.</> : 'The club toggle controls alerts for this club.'} An off club pauses channel alerts without erasing their preferences.
        </p>
        <CollapsibleContent className="border-t border-border/30 px-3 pb-2">
          {navigation === undefined ? (
            <p className="py-3 text-xs text-muted-foreground" role="status">Loading channels…</p>
          ) : tree.length ? (
            <NotificationChannelBranches nodes={tree} clubId={clubId} clubEnabled={clubEnabled} preferences={preferences} now={now} />
          ) : (
            <p className="py-3 text-xs text-muted-foreground">No channels available.</p>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function NotificationChannelBranches({ nodes, clubId, clubEnabled, preferences, now }: {
  nodes: NotificationChannelNode<Unit, Channel>[];
  clubId: Id<'clubs'>;
  clubEnabled: boolean;
  preferences: Preferences;
  now: number;
}) {
  return (
    <ul className="ml-2">
      {nodes.map((node) => (
        <li
          key={node.kind === 'unit' ? node.unit._id : node.channel._id}
          className="relative pl-4 before:absolute before:bottom-0 before:left-0 before:top-0 before:border-l before:border-border last:before:bottom-auto last:before:h-5 after:absolute after:left-0 after:top-5 after:w-3 after:border-t after:border-border"
        >
          {node.kind === 'unit' ? (
            <>
              <div className="flex min-h-10 min-w-0 items-center gap-2 text-muted-foreground">
                <FolderOpen className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 truncate text-sm font-medium" title={node.unit.name}>{node.unit.name}</span>
              </div>
              <NotificationChannelBranches nodes={node.children} clubId={clubId} clubEnabled={clubEnabled} preferences={preferences} now={now} />
            </>
          ) : (
            <ChannelNotificationRow channel={node.channel} clubId={clubId} clubEnabled={clubEnabled} preferences={preferences} now={now} />
          )}
        </li>
      ))}
    </ul>
  );
}

function ChannelNotificationRow({ channel, clubId, clubEnabled, preferences, now }: {
  channel: Channel;
  clubId: Id<'clubs'>;
  clubEnabled: boolean;
  preferences: Preferences;
  now: number;
}) {
  const mention = preferences?.find((p) => p.category === 'CLUB_CHANNEL_MENTION' && p.scopeKey === `channel:${channel._id}`);
  const global = preferences?.find((p) => p.category === 'CLUB_CHANNEL_MENTION' && p.scopeKey === 'global');
  const preference = mention ?? global;
  const muted = isMuteActive(preferences?.find((p) => p.category === 'CLUB_CHANNEL_MESSAGE' && p.scopeKey === `mute:channel:${channel._id}`), now);
  const enabled = !preference || (preference.enabled !== false && preference.level !== 'OFF');
  return (
    <div>
    <div className="flex min-h-10 min-w-0 items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Hash className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate text-sm" title={channel.name}>{channel.name}</span>
      </div>
      <NotificationScopeSwitch
        category="CLUB_CHANNEL_MENTION"
        label={`${channel.name} mentions`}
        clubId={clubId}
        channelId={channel._id}
        compact
        className="shrink-0"
      />
    </div>
    <p className="pb-2 text-xs text-muted-foreground">
      {preferences === undefined ? 'Loading effective preferences…' : !clubEnabled ? (
        <>Alerts paused by <a className="underline" href={`#notification-club-${clubId}`}>club notifications</a>. Your channel choice remains editable and saved.</>
      ) : muted ? (
        <>Alerts paused by a channel mute. <a className="underline" href={`/clubs/${clubId}/channels/${channel._id}`}>Open channel notification settings to unmute</a>. Your saved preference remains editable.</>
      ) : (
        <>{mention ? 'Channel override' : 'Inherited from global mentions'}: {enabled ? 'in-app alerts allowed' : 'off'}. <a className="underline" href={mention ? `/clubs/${clubId}/channels/${channel._id}` : '#notification-global-CLUB_CHANNEL_MENTION'}>{mention ? 'Channel alert settings' : 'Global mentions toggle'}</a>. Channel mutes can pause alerts; push also depends on browser setup and delivery availability.</>
      )}
    </p>
    </div>
  );
}
